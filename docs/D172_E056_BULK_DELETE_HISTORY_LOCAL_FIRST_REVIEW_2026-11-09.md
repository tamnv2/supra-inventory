# D172-E056 — OBPP v9 bulk-delete, 100-row history and local-first review (2026-11-09)

Status: SOURCE-VERIFIED ANALYSIS / PROPOSAL ONLY. No code, production, Sheet data or signed APK changed. D172 PENDING/HOLD; FIELD and OWNER PASS not inferred.

## Owner symptom / requirements
- On OBPP PDA, selecting/deleting all currently visible records (up to 100) lags and does not delete.
- Datasets may contain more than 100 records; 100 is a presentation batch, not the retention or deletion authority.
- Preserve a complete on-device history: local-first reads, not an ephemeral latest-100 JSONArray.

## Exact source finding (main 2026-11-09)
1. Confirmed deterministic request contract defect: `service/src/index.ts` OBPP proxy reads the entire non-GET body and returns 413 OBPP_BODY_TOO_LARGE if `body.length > 4096`; `service/src/obpp1291-core.ts` accepts up to 100 `{id,expected_revision}` entries. `obpp1291/.../MainActivity.kt::confirmBulkDelete` sends all selected 100 in one request. A synthetic, payload-only 100-item JSON with canonical 36-character UUID and single-digit revision contains 6,865 ASCII characters, exceeding 4,096 before reaching the Core handler. No real data/provider mutation used in this measurement.
2. Core `/obpp1291/records` GET always caps `limit` at 100 and returns only `{records}` in `created_at DESC` order: no client cursor, `has_more`, total or change token. The internal `/sheet/snapshot` supports limit/offset, but is a separate Worker-only mirror protocol, not a client history API. Server search q looks across Core records yet also returns maximum 100.
3. Android `refreshRecords` requests `?limit=100`, replaces in-memory `recordData: JSONArray` and renders rows from it. `selectedRecordIds` are retained only when in the currently filtered visible array. A bulk delete can only enumerate visible IDs, not the full server history. More than 100 records remain in Core but are not available for on-device complete history.
4. Android currently stores encrypted unsent draft via `ObppDraftStore`, encrypted OBPP session via `ObppSessionStore`, and diagnostics; no SQLite full-history repository is present in the reviewed Activity/store code. Business writes remain online-only and require server acknowledgement; no offline durable business outbox.
5. Core bulk delete validates every selected `expected_revision` in one `transactionSync`; a single missing/changed record returns 409 for the entire request. If successful, each record hard-deletes Core row, adds audit/delete intent/outbox; Sheet is asynchronous. This all-or-nothing contract is intentional but app currently presents a generic 409 rather than reconciliation and retry of valid records.
6. UI uses 100 dynamic history row layouts/checkboxes and rebuilds on changed GET; a single-thread network executor serializes OBPP calls; if PENDING, tab schedules GET as frequently as every 5 seconds (otherwise 30 seconds). These are credible UI/queue latency contributors, not measured device performance. Distinguish from the *verified* 413 blocker.

## Recommended two-stage implementation (requires explicit Owner approval)
**P0, preserve visible selection and one Worker request:**
- Keep the 100-item API cap, but allow a bounded route-specific request body (e.g. 16KiB for authenticated `/api/obpp1291/records/bulk-delete`; never broaden other routes/logs). Verify 100 entries at high revisions fit; reject beyond cap.
- Retain `operation_id` idempotency and atomic revision check. Surface HTTP413/409 accurately, show busy/progress and prevent repeated taps; on conflict re-fetch/current revisions, show changed records and let user confirm again. Never claim data deleted before positive Core ACK. Report Sheet mirror as pending separately.
- Distinguish `Xóa các bản ghi đã chọn` from whole-database purge; `Chọn tất cả` applies only to visible items; make visible-count and total-count explicit. Do not silently delete older hidden records. Batch server-side whole-history deletion requires separate explicit Owner-approved semantics/protection.

**P1, local-first full-history reads with Core as source of truth:**
- Add dedicated on-device private SQLite storage (Android filesystem encrypted by platform; no raw tokens in DB), indexed by record ID, created_at/id, store_code, do_code and location; scope by authenticated OBPP user/account and purge or isolate on account changes. Do not interfere with other PDA apps.
- Extend authenticated OBPP history API with deterministic keyset pages (100 per page) and `has_more/next_cursor`, stable snapshot fence, `total_count`; retrieve all pages incrementally in the background, persist transactional checkpoints and resume without resetting on app restart or network interruption.
- Add authoritative monotonically ordered delta feed including delete tombstones or equivalent durable server watermark: when another PDA edits/deletes, local history is updated/removes stale records. Do not infer deletion because it disappeared from latest-100 result. Handle reset, cursor expiry and full re-baseline; protect from out-of-order GET responses.
- UI reads from local indexed DB first; render only a bounded/virtualized visible subset while full data stays on device. Search MCH/DO/vị trí across full *hydrated* history, and declare incomplete sync until hydration done rather than incorrectly claiming not found. Continue online-only business mutations unless Owner separately authorizes a real offline business outbox; local-first reads do not imply local transaction authority.
- Reuse existing sync cadence/event triggers where feasible, avoiding polling per page after full hydration; do not add unbounded network loops or Sheets reads. Apply Core ACK to local DB only after server success. Account-scope/retention/access safety review required.

## Regression matrix
- 1, 50, 59, 60, 99, 100, 101, 250, 1,000 records; 100-item body limit, high revisions, 413/409/429/timeout; one stale entry in 100, idempotent replay; concurrent PDA edit/delete and duplicate.
- 101+ records: selection of exactly visible 100 must never silently delete hidden rows; search older history and pagination, last-page equal timestamps and stable ordering; full device restart/offline/reconnect/account switch.
- Delete Core row then asynchronous Google Sheet A:K mirror and audit; positions A:E and operations A:G unaffected; auxiliary columns preserved; error/backoff and eventual mirror reconciliation.
- Shared Worker and Inventory Báo hàng D173 regression (auth, health, DO/SQLite, recent E123 protections), separate D172 Android CI and signed OTA chain; no Stable or D173 application code edits.

## Approval and status
- This is read-only technical diagnosis recorded on a docs-only D172 branch/PR. Actual runtime code change, Worker deploy, independent signed OBPP APK release, real-device and Owner acceptance all remain NOT DONE / NOT AUTHORIZED by this analysis alone.
- Owner's present message authorizes diagnosis and clarifies local-first requirement; before implementing an architecture that touches existing accepted runtime, present impact and request explicit change authorization per AGENTS.md.
