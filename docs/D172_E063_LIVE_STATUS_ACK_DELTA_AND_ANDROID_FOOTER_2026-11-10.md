# D172-E063 — OBPP v11 status badges and operation footer remain stale until tab switch (10/11/2026)

## Owner FIELD report

1. OBPP shows **"Đang đồng bộ"** for a record although it is already present in the registered Google Sheet.
2. Status footer remains at **"Đang yêu cầu xóa"**, or does not refresh after create/other actions until the user switches tabs.

This is a new D172-owned FIELD defect report, **not** an Owner-approved Production release directive. D172 lifecycle remains PENDING/HOLD independently of Báo hàng D173.

## Source-grounded causes

- `service/src/obpp1291-core.ts` normal `POST /obpp1291/outbox/ack` changes `obpp_records.sync_status` from `PENDING` to `SYNCED` **without appending to `obpp_record_changes`**. The signed v11 APK first hydrates its SQLite history and only requests incremental `/records/changes` after `baseline_seq`; it cannot see the SYNCED flag that remains only in Core. Existing `/sheet/confirm-record` already adds a change but is reached only on manual/reconciliation repair and needlessly emitted duplicate transitions.
- The repeated Google outbox failure path may mark `ERROR` after three attempts but likewise did not emit a PDA delta, hiding sync failure.
- `MainActivity.kt` displays a footer from `lastSyncMessage`. Most operations assign the variable without updating the currently mounted TextView, and only a subsequent `showWorkplace()` due to tab change reconstructs the label. Poll refreshes history rows every 5 seconds even without a change, disrupting navigation and masking the stale-footer issue.
- This is **not** a new Google Sheet write issue; the E060 existing mirror batching and exact A:K/A:E boundaries remain untouched.

## Scoped code correction

- In existing D172 Core `outbox/ack`, match ACK to the durable outbox event, keep Core update and append one `UPSERT` snapshot to `obpp_record_changes` **in the same `transactionSync`**, only when the real record's current revision changes to SYNCED and no RECORD outbox operation for the ref remains unacknowledged.
- Emit the analogous `ERROR` delta only on the first failure-state transition. Suppress duplicate `SYNCED` journal writes from `sheet/confirm-record` when already synchronized. No new external Worker, Sheet or Firebase requests, no full history reload.
- Repair **already-stale pre-E063 on-device histories** without clearing account-scoped local SQLite: on the existing authenticated `/records/changes` call, D172 Core performs a one-time, durable, UUID-cursor backfill of up to **100** active SYNCED/ERROR records per call. It compares each latest persisted UPSERT snapshot with current Core status and emits only missing changes. A D172-only journal index and marker in existing `obpp_sheet_state` bound the scan and make the repair idempotent. This runs only until marker `DONE`, introduces **zero new HTTP requests and zero Google Sheet writes**, and preserves old deletion tombstones. Real SQLite integration test covers old Core SYNCED with missing PDA delta.
- Centralize Android footer `message(value)` to update both `lastSyncMessage` and the mounted `status.text` synchronously on the UI thread. All successful bulk delete/save/manual-sync acknowledgements call this function immediately; single delete removes only Core-ACKed local ID then re-renders current tab. Error callbacks clear in-flight state and retain truthful terminal message.
- History 5-second synchronization continues to fetch Core deltas while the tab is visible but **does not rebuild the 100-row list before the network result**. Only actual deltas trigger a visible row refresh, with scroll offset preserved.
- Add an isolated real SQLite in-memory integration test for successful Google ACK (PENDING→SYNCED delta), stale revision, repeated ACK, 3× retry → ERROR and recovery, manual confirm idempotency. Android source contracts and Gradle debug/disposable-key release compile. D173 shared Worker and repo authority/state guards required.

## Release boundary

D172 E063 **CODE / CI only** until a separately scoped Owner release authorization is explicitly present, with required source/CI pins. Worker first, then independently signed OBPP v12 APK if approved; never silently re-use E060 Worker-only or E061 Android-only authorization. Do not touch Inventory/D173 business UI/Agent, Firebase Rules, other Sheet tabs/auxiliary cells or Stable.

A real authenticated PDA post-release check of an existing row changing PENDING→SYNCED and create/delete footer immediately updating without tab changes is necessary for FIELD PASS. No live synthetic record or Sheet write authorized by this bug report. OWNER/FIELD PASS remain false.
