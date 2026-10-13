# SKU_MASTER — Canonical SKU master and import rules

Status: **CANONICAL PRODUCT SPEC**.

## Scope

Master data contains only `SKU` + `product name`. Do not add location/bin/pickface/quantity inventory fields.

## Excel import

- File type: `.xlsx`.
- Intended operating range: 10,000–50,000 rows.
- Detect SKU/name headers from the initial header area.
- Trim/normalize values; blank rows are skipped.
- Unsafe numeric SKU precision is rejected rather than silently changed.
- Same SKU + same name duplicates merge.
- Same SKU + conflicting names inside one file requires explicit Owner/Admin user choice in UI.
- Existing SKU with a changed name requires explicit confirmation.
- Existing SKUs absent from a later file remain; import is not destructive reset.
- Preview precedes Apply.
- Apply uses bounded idempotent chunks/retries; current client chunk target is 1,000 and backend maximum is bounded.
- File hash/request IDs support deterministic retry semantics.

## PDA catalog synchronization

- Server is catalog authority.
- PDA maintains local SQLite cache for operational search.
- Delta-first synchronization is required after bootstrap.
- Full 10k–50k catalog fetch is bootstrap/fallback only, not the normal response to every Master SKU change.
- Cache replacement must not destroy a valid old cache when a new download is incomplete/invalid.

## Open item

Exact Owner semantics for the SKU-reset confirmation described historically as random “6 chữ” remain unresolved. Do not invent them.

## PDA catalog atomic-cache contract

- Android/PDA catalog persistence uses local SQLite, not a TSV file as the authoritative cache.
- Delta/full synchronization writes into a staging table first.
- The app rechecks authoritative catalog version/count before promoting staged rows.
- Promotion to the active catalog is one local SQLite transaction.
- If download, pagination, validation, version recheck or promotion fails, the last valid active catalog remains usable for read-only search; no partial catalog replaces it.
- Existing legacy TSV cache may be migrated once into SQLite, then the TSV artifacts are retired.

## D116 — Admin SKU workspace

- Admin/Root **Danh mục SKU** is not an upload-only screen. It shows authoritative catalog count, version and latest update timestamp from the existing catalog metadata endpoint.
- The workspace provides bounded search by SKU or product name and renders current SKU, product name and update timestamp.
- Excel import remains the approved validated/idempotent flow. Current catalog data remains authoritative until the uploaded workbook passes parsing/conflict checks and the user explicitly applies it.
- Same-SKU/different-name conflicts continue to require explicit resolution; D116 does not add stock quantity, location/bin management or offline catalog mutation.
- Loading/searching this workspace is on-demand when the route is opened or the user searches; it introduces no background polling loop.

## D119 — WMS Tồn Bin assisted SKU synchronization

- The registered Supra HY1 Tồn Bin endpoints may be used only as a read source for SKU catalog assistance.
- Only `SKU` and `product name` are admitted into SUPRA Inventory. Bin, location, stock quantity, pending quantity and other inventory fields are discarded before persistence/logging.
- Same SKU + same name is a no-op. A new SKU may be added. Existing SKU + changed name remains an explicit-confirmation conflict and cannot be silently overwritten.
- A SKU missing from a later WMS result remains in the catalog; WMS sync is merge/additive, not destructive replacement.
- One fleet sync lease/version prevents duplicate downloads. An expired lease may be taken over.
- Existing validated Excel import remains available as manual fallback and uses the same conflict semantics.
- D119 does not reopen bin/location/quantity product scope.

## D122 — Agent synchronization visibility

- A completed Agent/WMS SKU synchronization is an operational event even when every incoming SKU already matches the catalog.
- Manual Agent sync must explicitly show success/failure and counts for new, renamed and unchanged SKU rows.
- Web **Danh mục SKU** exposes the latest successful sync checkpoint independently from `sku_master.updated_at` / catalog max-update time.
- The checkpoint is derived from the existing successful `SKU_IMPORT_CHUNK` audit event; no new table, provider, polling loop or stock/location field is introduced.
- A no-op sync must not falsify the timestamp for actual SKU data mutation.
## D124 — Fleet-wide single-daily Agent sync and observable progress

- The D119 expired-lease takeover rule is narrowed by D124: an expired **pre-Service preparation lease** may still be retried, but after the first Service import job is submitted the Asia/Ho_Chi_Minh daily operation is locked and no second automatic or manual Agent operation may be submitted that day.
- The daily lease persists `service_started=true` before the first import job. Successful completion records `DONE`; an uncertain post-submit timeout remains day-locked rather than being released for duplicate retry.
- Agent waits up to 180 seconds for each Service job and surfaces `PENDING` versus `RUNNING` progress. The Beta Function writes `RUNNING` before calling the internal Worker import endpoint.
- Manual and automatic runs expose concise stages for lease check, Supra catalog read, chunk number, Service processing and terminal result. These messages are observability only and do not add polling outside the active synchronization operation.
- Pre-Service failures may release the short preparation lease because no import job has been submitted. Once Service submission starts, duplicate prevention takes precedence over same-day automatic recovery.
- The existing additive merge/conflict rules remain unchanged: only SKU + product name, no delete on absence, explicit confirmation for name changes, and no bin/location/quantity persistence.

## D125 — Manual-file-only SKU source

D125 supersedes D119/D122/D124 only for WMS-derived SKU synchronization.

- WMS/Tồn Bin is no longer an approved SKU source.
- Remove/disable the automatic daily Agent SKU sync and any manual Agent action that reads SKU/product name from Supra.
- SKU master updates use the existing authorized manual file import supplied by the Owner/operator.
- Preserve existing file validation, header detection, safe SKU parsing, same-SKU dedupe, additive merge and explicit confirmation for changed product names.
- A SKU absent from a later import is not deleted automatically.
- Firestore `sku_sync_jobs` and `skuSyncCreated` are legacy implementation artifacts pending D125 cleanup; they are not authority to continue WMS SKU synchronization.

## D126 — Manual SKU remains final source for this workstream

D126 keeps the D125 manual-file-only SKU decision while cancelling the rest of the D125 Office rewrite.

- Existing Web manual file import is the only approved SKU-master update path.
- Agent must not read WMS/Tồn Bin to build SKU/product-name data.
- Automatic daily Agent SKU synchronization is disabled/removed.
- Firestore `sku_sync_jobs`, `skuSyncCreated` and WMS SKU catalog readers are legacy runtime to retire in D126; they are not fallback paths.
- Existing validation, header detection, safe parsing, same-SKU dedupe, additive merge and explicit changed-name confirmation remain unchanged.
- Missing SKUs in a later import are not deleted automatically.
- Automatic SKU synchronization is deferred until a later explicit Owner decision.

## D146 — Live PDA catalog refresh after Web import

A successful Web SKU import must refresh logged-in PDAs without requiring logout/login.

1. The committed import emits one realtime event `sku_catalog_updated` with scope `sku_catalog`.
2. Foreground Android clients receiving that scope run the existing version/delta-aware `SkuCatalogCache.sync()`; business/report scopes continue only after the catalog-sync completion callback.
3. The Worker also sends a **silent data-only FCM** compatibility signal with event `sku_catalog_updated`. It must not display an operational alert or full-screen notification.
4. Android persists a bounded local “catalog refresh pending” marker when the silent FCM arrives. Resume and the existing low-cost local runtime tick consume the marker and perform the same version/delta-aware sync.
5. The Worker remains the SKU authority; the push is an invalidation signal, not the data payload. The PDA still verifies server catalog count/version and uses the existing delta/full fallback logic.
6. Failure is retriable and must not require the user to sign out. No new polling cadence is introduced.


## D166 — Future-analysis-only Agent daily SKU file import concept (09/10/2026)

Owner asked to **record and analyze later** an optional daily flow: after Agent startup and readiness, use a **separate controlled browser** to visit Supra's SKU export screen, download SKU file, and submit through the Inventory catalog import path; declare DONE only after authenticated server-side completion. Assessment must cover simultaneous Agents/single daily execution, current active Picklist/HA/ACK safety, browser readiness/manual login, source/file validation, deduplication, rename conflicts and existing SKU-import guarantees, partial progress/restart/retry/outage, error messaging, current day boundaries and bounded usage.

**No implementation approval.** D126 supersedes legacy D119/D124 and keeps the **manual-file-only SKU source** and automatic WMS/Supra SKU sync retired. This potential future revision must go through a new explicit Owner decision after analysis; do not enable existing dormant Agent SKU jobs, extract browser credential/session material, add timers, interact with Supra, or mutate any catalog now. Reference: `docs/D166_APPROVED_BACKLOG.md`.

## D167 test-first checkpoint (2026-10-10)

Owner requests an isolated one-button test of Supra Bin Inventory download and import of SKU + product name only, before location data or automatic daily scheduling. No change to current catalog conflict, no-delete, chunk preview/apply rules. The current production source stays manual under D126 until a verified and Owner-approved runtime change. The isolated test candidate has no operational WMS session bridge today; test E2E is blocked rather than passed.


## D167 — Independently authenticated Windows test, SKU/name only (supersedes earlier IPC-only draft)

Owner explicitly approved an isolated experiment with its OWN signed-in Supra browser and its OWN Firebase WEB Beta login. For this limited test, the test executable may issue a read-only authorized `exportBinStocks` GET and use the existing authenticated `POST /api/admin/skus/import` Service endpoint, respecting real role/session authority. Test data `SKU + product_name` only; do not ingest locations or quantities. Preserve chunk preview, conflict confirmation, request-id idempotency and no-delete semantics. No new business-rule mutation is implied beyond executing the existing authorized import API. D126 restrictions on the operational main Agent and its WMS Confirm session remain unchanged, and no production Agent/Worker modifications are approved.


## 2026-10-11 — D167 Owner D05/D06/D07 supersedes D126 SKU source design

A ready PRIMARY Agent may execute a single daily read-only SKU export from its existing managed WMS browser after 05:00 VN. Record day-scoped job completion and source fingerprint so no Agent repeats a completed job. New valid SKU add automatically; changed names require Agent approval; absent SKU remains unchanged. Retain the existing Web manual import option. Add only LTA/Shelving historical classification, with effective_from/to and UNKNOWN before the first verified observation; no stock quantity or bin management. This is an approved business rule, not a release or source-code implementation. See docs/D167_OWNER_DECISIONS_D01_D10_2026-10-11.md.


## 2026-10-11 — D167 PRIMARY daily SKU sync source-backed design proposal (NOT CODED)

Owner prioritizes D05/D06 now, D07 area history and analytics before the remaining Web operation-screen corrections. Proposed tightly coupled contract and tested-source blockers: `docs/D167_AGENT_SKU_AREA_REPORT_DESIGN_2026-10-11.md`. Current separate SKU test parses only SKU/name and uses its own browser; do NOT promote its header/signature capture into Agent or treat three sampled readbacks as complete catalog reconciliation. A safe production job must remain in existing managed browser, use a dedicated AGENT-auth scoped Inventory API, server-owned VN daily generation-fenced durable job/preview/rename approval and complete readback; no SKU deletion, no WMS auth extraction and no Confirm interruption. No actual code/release authorization in this design PR.

## 2026-10-11 21:33 VN — D167 Owner latest override: 3 scheduled PRIMARY SKU exports

Supersedes the former one-DONE-per-day and mandatory approval for cross-day WMS renamed SKU. Three per-date slots: **INITIAL_05** after 05:00 WMS ready = verified complete FULL snapshot, replaces today's active SKU membership and hides absent SKUs without deletion; **DELTA_12** = one stable randomized target within 12:00–12:15; **DELTA_19** = one stable randomized target within 19:00–19:15. Both later slots import sparse name/coarse-area changes and new/reactivated SKUs, never hide a SKU missing from the intraday source. Source SKU + name + trusted coarse area unchanged => zero SKU row write. Store one server receipt per (VN day,slot), no new provider polling, HA-generation fenced, no concurrent WMS export; if INITIAL FULL has not completed, next eligible safe export initializes FULL before any DELTA.

Web manual import defaults to PATCH with revision-gated conflicts; an explicitly approved FULL REPLACE is separate. If WMS source is unchanged, do not revert same-day manual Web changes; same-field manual/WMS conflicts require privileged preview/approval. A valid complete source without 'Có thể lấy hàng' can produce UNKNOWN; missing area column/partial file must preserve existing location. Scope remains read-only coarse LTA/Shelving/UNKNOWN, no bin or stock management. Full source schema/security/atomic publish/full readback gates remain pending. See `docs/D167_OWNER_DECISIONS_D01_D10_2026-10-11.md`. No executable implementation or deploy approved.



## D167 Owner final SKU source and daily acceptance — 2026-10-12

Owner requires **same-VN-calendar-day verified FULL membership** before a NEW shortage report is accepted. Agent INITIAL FULL and explicitly confirmed, validated Web FULL REPLACE both qualify; Web PATCH/old unchanged cache does not. Missing FULL returns `SKU_TODAY_SYNC_PENDING` and Picker/Reporter online Web/Android must show the exact specialist warning. Starting a new VN calendar day resets readiness even during 00:00–05:00; no stale fallback. Previous batches, results, ACK and Confirm remain operational. The first confirmed FULL must propagate a day-ready refresh even if SKU rows did not change. Authorization provenance is `docs/OWNER_DECISIONS.md` 2026-10-12; implementation and Beta release are separate.

The PRIMARY's approved read-only source is a direct, narrowly allowlisted signed export GET using transient user-authenticated WMS header material from its managed-browser context. It must not automate the existing Confirm tab or persist/log/relay auth, and it must fail closed on missing proof. Previous blanket `outside browser forbidden` wording is superseded **only** for this bounded, in-process RAM GET. No WMS mutation or new provider/resource.


## D167 2026-10-12 — Owner-approved Agent SKU operation tab and manual source run
The Agent adds a local-first SKU operations tab. Show each scheduled INITIAL_05, DELTA_12, DELTA_19 with assigned VN target, verified COMPLETE/DONE receipt, skip-coalescence, row/new/updated/hidden/unchanged counters, and recent manually authorized runs using the same existing schedule response. WMS SKU/area table is a local in-process snapshot of the last downloaded valid workbook, not authoritative post-restart or after Web/manual edits; mark its provenance and limit on-screen rows with local search. Never expose stock qty/bin or WMS credentials.
The protected manual button submits a fresh normal-Agent password or privileged OTP/emergency credential for independent Worker verification and fenced HA PRIMARY proof. No valid FULL for today's VN date => reuses INITIAL_05 FULL once without waiting for scheduled 05:00; valid daily FULL => unique MANUAL_DELTA_<run-id> slot, only sparse SKU/name/coarse area changes and no missing-SKU hide. Manual runs cannot silently complete DELTA_12/DELTA_19, may not collide with Confirm, preserve SQL CAS/stage/preview/commit, and never claim success without readback. Local GUI uses event notifications and optional user-invoked schedule GET, never a new polling/FCM/Firebase stream.


## D167 2026-10-13 — Owner đồng ý dùng phiên Agent chính

Với luồng tải SKU tự động hoặc thủ công của PRIMARY, lấy ngữ cảnh WMS xác thực từ trình duyệt hiện đang chạy bên trong Agent chính; không bắt buộc mở một trang ẩn mới nếu có phương pháp được hỗ trợ và kiểm thử an toàn. API phải giữ nguyên phạm vi read-only XLSX và giới hạn HY1 đã đăng ký; tuyệt đối không sửa trang Confirm PickList, không tạo thay đổi dữ liệu WMS. Không ghi nhật ký hay lưu thông tin phiên, không dùng lại phiên khi đã mất PRIMARY. Nghiệm thu thực tế đòi hỏi chứng minh xuất XLSX thành công, dữ liệu hợp lệ và biên nhận DONE từ Service. Phạm vi này được Owner duyệt nhưng phần lấy ngữ cảnh trực tiếp từ tab chính chưa triển khai/không được coi là PASS.

## D167 2026-10-13 — P0 xác minh máy chính và ghi người cập nhật (Owner approved)

Chỉ trong thao tác đồng bộ SKU được phép, Agent PRIMARY kiểm tra generation và làm mới Firestore lease hiện có theo khoảng cách tối thiểu 20 giây; không tạo heartbeat ghi Firestore thường trực, listener mới hoặc đọc dữ liệu WMS phụ. Worker vẫn yêu cầu chứng cứ chính xác roles+lease của Firebase hiện hành, TTL 45 giây; sai PRIMARY/generation/lease hoặc thiếu cấu hình phải dừng. Dữ liệu FULL đầu ngày và 2 lượt DELTA, các xung đột Web, quyền admin và biên nhận DONE không thay đổi.

Mỗi biên nhận cập nhật thành công lưu `actor_id` và `actor_display` từ tài khoản Agent đã được Worker xác minh (`display_name` + `employee_code`, không nhận danh tính do client tự khai). UI lịch ba lượt và lịch thủ công đọc từ đúng response schedule/receipt đang có, thêm cột **Người cập nhật**; trong lúc thao tác thủ công hiển thị tên tài khoản phiên hiện tại. Không thêm truy vấn tìm user và không ghi user tại từng SKU. Chỉ ghi DONE khi Core đã xác nhận hoàn tất, không nhận DONE từ riêng Excel xuất ra.


## D167 2026-10-13 — Owner cancels direct MAIN-tab WMS authentication requirement

SUPERSEDES the earlier demand to implement new credential/authorization acquisition directly from the live WMS Confirm tab. The current separated same-profile WebView2 child and allowlisted read-only SKU export transport are **accepted as the chosen approach**; do not reopen a MAIN-tab direct extraction work item or create alternative unsafe replay path. Preserve agent PRIMARY/generation checks, in-process short-lived authorization context, no token/header logging or persistence, no interaction with WMS Confirm tab, same-day FULL and later DELTA rules. This removes an **unimplemented design request**, not a field bug or a claim of successful Service DONE. No runtime code, SKU source or provider configuration is changed by this decision.
