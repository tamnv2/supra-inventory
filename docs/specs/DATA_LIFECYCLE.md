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


## D069 Web runtime diagnostic logging

Web runtime logs are support/diagnostic artifacts, not business authority.

The diagnostic snapshot may include bounded:
- page/section/theme/zoom and safe UI-state counts;
- browser/device-class capability data, viewport/screen, network reachability/RTT and JavaScript memory where the browser exposes them;
- navigation/paint/resource timing, long-task samples, DOM element counts and render durations;
- API method/path, HTTP status, retry/refresh flags and latency; query **keys** may be recorded but query values are not required for diagnosis;
- realtime connection/recovery/apply timings and sequence state;
- safe interaction descriptors such as clicked control label/id/data action, without input values;
- recent application errors and bounded recent operational UI events.

Diagnostics must never contain authorization headers, ID/access/refresh tokens, passwords, cookies, API keys, credentials, private/signing/keystore material or secret runtime values. Input/change logging records control identity only, never typed values. Client and server both sanitize/redact, and each uploaded file remains size/depth/count bounded. Google Drive Logs remains a support store; it is not a transaction database.


## D070 timing / automatic-Skip lifecycle

D070 adds durable operational timing evidence without creating a second transaction store.

Per batch/ticket where applicable, hot authoritative data may retain:
- automatic deadline timestamp assigned when the report becomes eligible;
- per-ticket `auto_skip_allowed_at`;
- resolution and `resolution_source` such as `REPORTER`, `SYSTEM_TIMEOUT`, or correction source;
- idempotent warning/escalation deadline-event markers;
- audit entries for policy changes, warning/escalation transition and automatic-Skip result.

Rules:
- server time is authoritative;
- existing legacy work is not backfilled with an automatic deadline merely because D070 is activated/re-enabled/mode-switched;
- disabling or switching auto-Skip mode clears not-yet-fired automatic deadlines fail-safe;
- a fired automatic result is durable business history and is never erased by disabling the feature later;
- correction creates normal immutable lifecycle/result evidence rather than rewriting prior timeout history;
- retention/archive must preserve enough result/source/timestamp evidence to distinguish Reporter decisions from system timeout outcomes.

## D085 relay audit and temporary coordination data

Relay coordination/rate-limit records are supporting operational metadata, not Báo hàng transaction authority.

- Leader lease contains bounded Agent identity/heartbeat/WMS-ready metadata only; no WMS secret/session values.
- Picker anti-spam state stores account identity, strike window, lock level/timestamps and update timestamps so restart/device change cannot bypass a lock.
- Job ACK may carry bounded cache mode, strike count, lock level and lock-until timestamp.
- Diagnostics/audit may identify Picker user and processing Agent/Admin for abuse investigation, but must not store raw WMS credential/session/signature material or the full/raw five-digit lookup value.

## D086 local Agent secret-state lifecycle

The D086 encrypted WMS session file is local workstation support state, not business authority and not project archive data.

- It is protected with Windows DPAPI `CurrentUser`; plaintext WMS request-session material is never intentionally written to disk.
- It is renewed only after successful approved read-only WMS validation/preload/refresh and is cleared when classified unusable/expired.
- It is excluded from GitHub, RTDB, Google Drive support logs, runtime-log upload, screenshots/diagnostics and long-term archive.
- D085 relay audit may continue recording bounded Agent/result/timing metadata, but never the encrypted file contents or raw WMS session/header/signature values.



## D087 local Agent observability lifecycle

- Agent creates two bounded local support logs per runtime: PDA-Agent operational audit and technical-AI diagnostics.
- Both are non-authoritative support artifacts and pass the same credential/session redaction layer.
- Operational audit may retain the exact approved five-digit Picklist suffix with request/user/device/Agent/result/timing metadata for incident correlation. Full WMS identifiers/responses and any credential/session/signature values remain forbidden.
- Local APK-received and Agent-response counters are process-memory only and reset when that Agent process restarts.
- relay_poc/coordination/agents/{instance} is temporary presence metadata only. It stores bounded Agent identity/machine/heartbeat/WMS-ready fields; stale entries are ignored after 90 seconds and are not business history.

## D088 — interactive session lifecycle

- Server `users.session_generation` is the authority for the single Web/Android interactive session.
- A fresh Web/Android login atomically advances that generation. Tokens carrying an older generation are no longer accepted for authenticated APIs or token refresh.
- Web stores its refreshable session in local browser storage; Android stores its refreshable session in app-private preferences. Neither surface stores the plaintext password.
- Logout/401 clears the local session. Password change advances generation.
- The Agent auth channel remains separate from interactive generation so multiple approved real-ADMIN Agents may coexist for D085 HA.
- Session lifecycle adds no periodic Cloudflare/Firebase polling requirement.


## D097 confirmation relay lifecycle and quota envelope

D097 temporary Firestore records remain support/relay state, not Báo hàng transaction authority.

- A confirmation job is created as `PENDING` and reaches terminal `ACK` directly; no durable `PROCESSING` row is written.
- Non-confirmed terminal jobs may be cleaned after ACK. Confirmed/uncertain jobs retain bounded guard/job evidence long enough to preserve cross-Agent idempotency and fail-closed semantics.
- Timed-out PENDING jobs are not eligible for new Agent WMS work after 30 seconds even if cleanup is delayed.
- The full PickListCode is never stored raw in Firestore guard ids; the existing non-reversible hash remains authoritative.
- Presence/coordination records are low-frequency temporary metadata. FROZEN Agents must not create business polling load.
- Free-quota design target is based on 6,000 requests/day and 30 simultaneous requests; operational code must not reintroduce 4-second leader writes, per-job PROCESSING writes or 1-second PDA GET polling.
- Cleanup never contains credentials/session/signature material and remains separate from long-term business archive.


## D100 — Explicit system-reset deletion boundary

System Reset is a deliberate ROOT-only data-zeroing operation, not normal retention.

- No table/schema is dropped. Deletes run in bounded/transactional InventoryCore operations where applicable.
- Account reset affects only selected non-ROOT role rows plus linked service session/device records and corresponding Firebase Auth identities.
- Open-report and history reset delete dependent rows in foreign-key-safe order.
- SKU reset empties `sku_master` and resets catalog metadata to zero.
- Service-log reset never deletes Drive files.
- Runtime-settings reset clears service configuration rows but never edits/deletes the referenced external Sheet.
- Firestore confirmation reset is optional and separate; active PENDING jobs block deletion.
- ROOT remains usable throughout the reset.
- External Google Sheet/Drive archives remain durable external records and are not used as an automatic restore source.

## D100 post-reset runtime invariant

- `RUNTIME_SETTINGS` resets user/business runtime configuration but must not leave the service structurally unready.
- The reset may clear `app_config`, but the Operational V2 structural baseline is immediately recreated in the same Durable Object execution. A fresh realtime stream epoch is generated so clients resynchronize against the reset state.
- Structural metadata (for example `realtime_stream_epoch_v1`) is excluded from the user-facing resettable configuration count.
- After a successful reset, business APIs, realtime ticket issuance, account recreation and SKU import must work without a redeploy or manual restart.

## D101 — Agent rolling logs and Beta Drive delivery

- Local Agent diagnostics use two rolling streams: technical and PDA-Agent audit. Each current file rotates at approximately 2 MiB and retains at most four rotated predecessors plus the current file.
- Restarting the Agent does not create a new log file solely because a new process started.
- Scheduled sanitized Agent bundles target 06:00, 12:00, 18:00 and 00:00 Asia/Ho_Chi_Minh time.
- Agent never stores Google OAuth credentials. It writes bounded temporary chunks to Beta Firestore collection `relay_agent_log_uploads` using the authenticated real-ADMIN Firebase session. The Beta Worker drains complete bundles into `Inventory/Beta/Logs` using the existing Drive OAuth secret, then deletes the Firestore chunks after successful Drive upload.
- Crash/FATAL uses the same channel immediately on a best-effort basis. If no valid Agent auth is available, a local pending crash marker is retained and retried later. Crash filenames start with `crash_`.
- Agent log spool is temporary support state, not business authority, and is included in Confirmation Relay reset scope. Stable is untouched.
## D102 — Agent schedule state and fleet metadata

- The after-hours decision is local non-sensitive state keyed by the HCM business night. It stores only the night key and CONTINUE/STOP; no password, token, WMS session or business payload is stored.
- Presence remains temporary support metadata. D102 cadence is 15-minute Agent presence writes, 30-minute fleet reads and 40-minute presence freshness, plus event/startup refreshes.
- Agent version is allowed in presence metadata for operational fleet display. Hardware metrics such as CPU/RAM/Disk are local-only and are not persisted to Firestore.
- At 05:00 the prior night's local decision no longer controls business processing; the next 21:30 window requires a new decision.

## D104 — Batch confirmation state

- No new durable batch entity is introduced. Firestore job, guard, rate-limit and ACK documents remain individually keyed exactly as before.
- Manual multi-search state is UI-local only. Normalized search fragments and displayed full PickListCodes are not persisted as new project data.
- WMS batch mutation payload contains only the exact full PickListCodes already authorized for confirmation plus the existing fixed HY1 flags. Session/auth/signature headers remain runtime-only secret material.
- Successful batch confirmation marks each acquired guard locally confirmed. Safe failures may release the affected per-code guard. Uncertain outcomes remain guarded/fail-closed and are not automatically replayed.
- Existing retention/cleanup for Firestore job and guard documents is unchanged.

## D105 — Four-digit request data

- Current Android relay jobs store a four-digit `suffix`; legacy five-digit jobs may coexist transiently during rollout.
- The suffix remains bounded operational correlation data. Full PickListCode, WMS response body and WMS credential/session/signature values remain forbidden from Firestore/logs.
- Confirmation guard identity continues to derive from the resolved full PickListCode, not from the short suffix, so reducing input length does not weaken cross-Agent mutation idempotency.
- Retention/cleanup semantics are unchanged.

## D109 management audit storage

- Meaningful REPORTER/ADMIN/ROOT management and business mutations continue to be stored in the existing InventoryCore `audit_log`; D109 adds actor role/display-name projection to make the history readable.
- Audit reads are bounded and paged. D109 does not add a second analytics database, browser-side audit authority or a background export/polling loop.
- Secret-like metadata keys are redacted before audit-history responses are returned.
- Existing ROOT System Reset `SERVICE_LOGS` semantics remain the explicit destructive path for service audit/log data; D109 does not silently purge or rewrite business history.

## D111 — Android operational display window

The Android App uses an operational display projection, not a retention change.

- Business-day boundary: Asia/Ho_Chi_Minh (+07:00), current local midnight.
- Picker projection: reports created on/after current business-day midnight **OR** older tickets still OPEN, not auto-skip-completed, with a PENDING batch.
- Reporter pending projection: all unresolved PENDING batches, including earlier business days.
- Reporter recent projection: HAS_STOCK / SKIP_ALLOWED / CLOSED batches whose first report is on/after current business-day midnight.
- The projection is applied in InventoryCore SQL before the bounded result limit. Historical source data, archive/retention, Web reporting and export remain unchanged.

## D112 — 90-day operational audit and support-log retention

- `audit_log` is hot management audit, not long-term archive. InventoryCore retains at most the most recent 90 days and performs a bounded opportunistic prune without creating a new polling/provider loop.
- Web management audit views default to 30 days and may explicitly request 60 or 90 days. Picker remains excluded from the management audit view.
- Beta Web/Android/Agent support logs in the configured `Inventory/Beta/Logs` Drive folder have a 90-day operational retention boundary. Retrieval defaults to 30 days and may request 60 or 90 days.
- Support-log cleanup is bounded, credential-safe and best-effort. A cleanup failure must not fail a business mutation or log upload.
- Business transaction history/archive semantics remain separate from support-log retention. D112 does not convert Drive logs into business authority.
- Android downloaded update artifacts are temporary support/distribution files and are removed best-effort after restart/current-version verification; they are not business data.

## D119 — Presence, alert and fleet-metric retention

- Picker presence is current-state projection only; it is not long-term attendance history.
- FCM target/token material is private service data and is never copied into Agent-readable presence documents.
- Picker-contact commands use bounded TTL and may retain only sanitized audit metadata after completion.
- Fleet metric checkpoints are aggregate operational counters, not per-Picker behavioral history.
- WMS SKU-sync staging discards stock/bin/location/quantity fields before durable product persistence and retains only bounded sync/conflict audit metadata.
