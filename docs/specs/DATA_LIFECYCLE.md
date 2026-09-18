# DATA_LIFECYCLE — Canonical operational data, archive and retention

Status: **CANONICAL PRODUCT SPEC**.

## Transaction authority

`Cloudflare Worker → InventoryCore Durable Object → SQLite` is operational authority.

Google Sheets/Drive support HR source, archive and export; they are not competing primary business stores. There is no offline/direct-to-Sheet transaction path.

## Core semantics

- **report ticket** = one Picker report identity/history.
- **processing batch** = grouped handling of same-SKU unresolved work across Pickers.
- **lifecycle/audit event** = immutable business transition/audit semantics.
- **sequenced realtime event** = bounded synchronization read model emitted after/with committed business state, carrying monotonic `seq` and current batch version/scope metadata.
- **critical result acknowledgement** = per-target delivery/interaction state for a resolved result event; it is not the business resolution itself.

These semantics remain separate in APIs, reporting and archive.

## Batch version

Each processing batch has a monotonically increasing integer `version`.

Version changes when authoritative batch-visible state changes, including at minimum:
- a Picker ticket is attached to the pending batch;
- a Picker withdraw changes the affected open-ticket set;
- resolution to `HAS_STOCK` or `SKIP_ALLOWED`;
- correction from `SKIP_ALLOWED` to `HAS_STOCK`.

Clients must not accept a lower-version event as newer state. Version is an optimistic/read-model freshness marker, not a client-controlled mutation token.

## Recurrence / episode linkage

- Finalized `HAS_STOCK`/`SKIP_ALLOWED` batch episodes are immutable.
- A later report for the same SKU creates a new batch and may link `previous_batch_id` to the most recent resolved same-SKU batch.
- `previous_batch_id` is informational/audit lineage; it never makes the old batch pending again.
- A batch closed solely because all Pickers withdrew is not considered a confirmed resolved shortage episode for recurrence linkage.
- Reporting may calculate recurrence interval from previous resolved time to new first report time.

## Sequenced realtime retention

A dedicated sequenced realtime event table/read model may coexist with immutable `report_events` so legacy history does not need sequence rewrites.

Requirements:
- strictly increasing server sequence for newly emitted synchronization events;
- event identity, business event type, batch/ticket identity where applicable, batch version, authorized scopes, bounded payload and created time;
- bounded delta reads by `after_seq`;
- sequence rows retained long enough to make normal reconnect/gap recovery practical;
- if requested sequence is no longer available, API explicitly marks delta incomplete so the client performs authoritative reconcile.

Realtime rows may be compacted independently from long-term business audit if the durable `report_events`/audit records remain intact.

## Critical result acknowledgement lifecycle

For each critical result event and affected Picker, the server maintains one acknowledgement record keyed by event + target Picker (+ batch/version identity).

Monotonic stages/timestamps:
- created/targeted;
- received;
- displayed;
- acknowledged.

Rules:
- repeated stage updates are idempotent;
- stage cannot regress;
- explicit ACK actor must match the target Picker/session;
- ACK never changes a finalized batch back to pending;
- correction creates a new result event/version and therefore a new acknowledgement lifecycle while preserving the previous event history.

## SLA configuration/state

SLA thresholds are explicit server configuration, not hidden constants copied from the reference product.

Approved configuration:
- warning minutes;
- escalation minutes, greater than warning.

Derived batch state:
- `UNCONFIGURED` when no valid settings exist;
- `NORMAL` before warning threshold;
- `WARNING` at/after warning threshold;
- `ESCALATED` at/after escalation threshold.

SLA is computed from authoritative server time and `first_report_at` for pending batches. It never performs a business resolution or changes historical timestamps.

## Diagnostics lifecycle

Support diagnostics are bounded and redacted. They are not business authority and must never store secret values. Recent technical error codes/status may be kept locally/server-side only within approved bounded diagnostics/log retention.

## Runtime support logs (D063)

- Beta runtime support/error logs are stored only inside `Inventory/Beta/Logs` in Google Drive. Stable remains separate and Owner-gated.
- Sources are `WEB` and `ANDROID`. File names include source, a bounded device identifier/label and Asia/Ho_Chi_Minh timestamp; error files use the `error_` prefix.
- Both client and service sanitize log content. Passwords, authorization headers, bearer/JWT values, refresh/access tokens, API keys, OAuth secrets, private/signing/keystore material, cookies and credential-like fields are redacted and never intentionally persisted.
- Log payloads are bounded. They may contain app/version/device/network/realtime/catalog state, current UI section, safe runtime memory/storage data and bounded recent diagnostic events needed for troubleshooting.
- Authenticated connected clients attempt one periodic log for each local-time slot 00:00, 06:00, 12:00 and 18:00. `24:00` is represented by the next day's `00:00` slot.
- Web runtime errors (`window.error` / unhandled promise rejection) are sent immediately on a best-effort basis and retained locally only as a bounded pending sanitized error until an authenticated retry is possible.
- Android runtime errors are sent immediately when an authenticated session/network is available. An uncaught crash is first persisted as a bounded sanitized crash envelope, then upload is attempted before process handoff; if that attempt cannot finish, the envelope is retried after the next authenticated start.
- Admin/Root can list/read sanitized Web/Android log files and Web/Android users can trigger a manual client-side log upload where the client exposes that action. The service never accepts unauthenticated log upload.
- D063 does not introduce an automatic log-deletion policy because the Owner has not specified retention yet; each file is bounded to control Drive growth.



## Controlled Beta load-test data (D064)

- The D064 1,000-report workload uses the normal authoritative Picker report API and therefore creates normal **Beta-only** report tickets/batches/events/audit/idempotency/realtime records. It never writes directly to SQLite and never touches Stable.
- Load-test request IDs use a bounded `d064:<test-id>:...` prefix so idempotency records remain attributable without adding a parallel transaction path.
- The workload is intentionally retained under the ordinary Beta lifecycle after the test so the Owner can inspect queue/UI/storage impact and archive/retention behavior. Do not silently delete or reset the measured data unless the Owner explicitly requests a Beta reset.
- The persisted load-test summary is bounded operational metadata only: counts, timings and before/after aggregates. It must not persist Firebase ID tokens, the ephemeral load-test gate token, passwords, private/signing material or raw credentials.
- The temporary load-test gate exists only during the GitHub Actions run, is enabled only with `APP_ENV=beta`, and is explicitly cleared in an always-run cleanup step.


## Retention

- Detailed hot operational retention target: about 60 days.
- Pending/unresolved items survive retention until handled.
- Cleanup may remove only finalized business data that has a confirmed archive-export marker.
- Critical ACK/business audit needed for a finalized batch follows the associated archive/retention safety contract.
- Realtime synchronization rows may use a shorter bounded retention/compaction window provided delta incompleteness is explicit and durable business audit remains available.

## Archive

- Archive is batched to the configured Beta archive Sheet/Drive resources.
- Fixed row ranges + SQLite checkpoints/markers provide retry-idempotency.
- Archive mark occurs only after external write success.
- Cleanup runs after archive eligibility is proven.
- Current schedule is daily around 03:15 Asia/Ho_Chi_Minh plus Root manual execution where implemented.
- Do not hot-write every business event/ACK/realtime frame to Google.

Archive format may be extended with recurrence/version/ACK summary fields in a backward-compatible bounded export; exact final export columns remain governed by reporting decisions.

## Environment isolation

Beta and Stable data are isolated. Do not copy Beta runtime data into Stable by default. Stable schema source may be prepared in code but Stable provisioning/migration/deploy remains Owner-gated.
## Immutable critical result snapshot

Each `BATCH_RESOLVED` / `BATCH_CORRECTED` result event preserves an immutable snapshot keyed by `result_event_id` containing at least batch/version, SKU, product name, resolution and result time.

- Pending-result/ACK reads use this event snapshot, not mutable current batch resolution.
- Existing historical result events may be backfilled only from durable event payload/time/version evidence. Current batch resolution must not be used to rewrite an older event.
- Correction therefore retains both the prior result event and the new correction result event with separate ACK lifecycles.
- Ticket, result-target and acknowledgement aggregates are computed independently before presentation; joins across multiple one-to-many tables must not multiply counts.
## Realtime stream epoch, scan cursor and applied state

The realtime event table uses one global monotonically increasing sequence. Authorization can remove rows from an individual client's projection, so per-user visible events are not a contiguous numeric sequence.

The server maintains a persistent `stream_epoch` for the current sequence space. Delta responses expose `retained_from_seq`, `latest_seq`, global scanned `cursor_seq`, `has_more` and explicit `resync_required` metadata.

Clients distinguish:
- **scanned cursor**: server position examined while producing an authorized delta page;
- **applied cursor**: position whose relevant authoritative read-model effects have been successfully applied by that client.

Only the applied cursor is persisted as recovered client state. If read-model application fails after a page/socket event arrives, the client remains dirty at the prior applied cursor and retries/reconciles. Epoch changes, a cursor ahead of the current stream, or a cursor older than retained history require an explicit authoritative reconcile before the client commits the replacement cursor.

## Notification delivery-attempt telemetry

Notification-provider attempt rows are technical delivery telemetry, not business authority.

- Each bounded attempt may record result/event identity, event type, device/user identity when resolvable, `SENT`/ `FAILED` provider outcome, bounded provider error code and creation time.
- Invalid/unregistered provider tokens may be disabled from the authenticated device registry without changing business resolution.
- Delivery-attempt retention is bounded independently from durable report/result/ACK audit; current source keeps only the newest bounded attempt window.
- Client `RECEIVED`, `DISPLAYED` and explicit `ACKNOWLEDGED` remain separate monotonic stages.

## Archive coverage for Operational V2 lifecycle data

Archive candidates for finalized batches include the newer immutable/lifecycle metadata needed to reconstruct the shortage episode:

- batch `version`, `previous_batch_id` and `last_report_at`;
- result-event immutable `batch_version`, result resolution and result timestamp;
- per-target receipt lifecycle (`RECEIVED`, `DISPLAYED`, `ACKNOWLEDGED`) encoded with the archived result event.

The existing archive workbook/tabs remain the transport surface; no new archive resource is required for these fields.

Retention cleanup may delete hot finalized data only after that batch is marked archived. Cleanup must remove associated result acknowledgements, immutable result snapshots, realtime rows and correlated notification-attempt telemetry before deleting report events/tickets/batch, preventing orphan operational rows. Unresolved batches remain outside cleanup.
