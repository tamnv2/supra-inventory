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

## D167 Web SKU truthful provenance and catalog workspace — 2026-10-13

Owner-approved Web/Worker Beta correction. The catalog-info endpoint's untyped last_sync_at is a SKU_IMPORT_CHUNK audit timestamp, not an Agent event; max_updated_at is a catalog mutation timestamp, not a proved Agent FULL. Retain both existing values and fields for Android/PDA compatibility, but the management Web SKU page must use a separate manager Web-only read response from existing audit_log Web PATCH chunks/Web FULL and d167_sku_jobs DONE receipts (Agent FULL/DELTA) with source/mode/actor/time/counts, never generic update-time heuristics. Web PATCH chunk summaries are not guaranteed to be whole workbook totals. Keep 3 compact cards, source-specific latest row/short history, version in tech details, full-width searchable active SKU table including area and collapsed Excel upload that keeps all existing validation/role/conflict/FULL business semantics. One additional bounded DO SQL read only on page entry / five-minute refresh and after import, zero extra background polling, no Android/Web picking catalog behavior change. Field and Owner PASS distinct from CI/Release PASS.


### D168 2026-10-13 — SKU uplink under Office-only company network (analysis-only)

Owner reports direct Office → Cloudflare access is unavailable. Existing D167 code already separates (A) registered WMS Bin Inventory XLSX read-only HTTPS GET using the current Agent-managed session/system corporate proxy from (B) uploading validated, normalized SKU snapshots via the **registered Google Apps Script Agent Operations Gateway** to Beta Worker/InventoryCore. Agent must never forward raw WMS tokens, cookies, request signatures or unvalidated workbook. Service remains authoritative for FULL/DELTA daily slot, PRIMARY lease/CAS, fingerprint reconciliation and durable `DONE`; Office routing alone is not successful SKU publication.

This routing depends on Office allowing the Google Web App **and its ContentService redirect to script.googleusercontent.com**, and on available Apps Script UrlFetchApp quota. Company Firebase Auth/Firestore access does not prove full Gateway endpoint reachability. The 2026-10-13 Agent logs show SKU attempts repeatedly failed; no `DELTA_19` DONE was verified from those local logs. A safe Office-only schedule/status probe and later controlled FULL/DELTA receipt proof are pending; a hypothetical Firestore/Google Function relay is not an approved implementation. Do not change approved WMS read-only path, add polling, bypass corporate proxy restrictions, or alter Stable. D168-REQ-011 remains awaiting Owner code/deploy approval.


## D168 Owner-approved functional target — SKU job lease survives HA role change (2026-10-13)

**FUTURE CODE TARGET — NOT IMPLEMENTED IN v130.** The active PRIMARY may authorize/admit the automatic SKU job, but a job that validly began must **retain separate SKU job ownership** after that Agent loses the HA PRIMARY role, until durable Worker DONE, terminal failure, or bounded server-fenced lease expiration. New PRIMARY must observe Worker job ledger state and not start a duplicate job while one is valid. A former owner after expiry/takeover must be fenced and cannot publish. Preserve source fingerprint, three VN scheduled slots, first-day FULL, latest DELTA priority, approved manual conflicts and 03:00 boundary.

The required path is WMS XLSX read-only export/normalization first on the WMS-capable network, then an authenticated direct Cloudflare route if available. Only if direct Cloudflare is blocked may the Agent prompt for an approved WLAN profile switch (Office->approved PDA saved profile first, fallback strictly allowlisted), upload Worker chunks and exact DONE verification, then restore original network. Skip = 15-minute retry; no response at 60s permits switching only after all HA/confirm/idle checks pass. An ongoing business transaction or lack of a safe standby on a sole PRIMARY defers the switch rather than interrupting Picklist service.

**Implementation gap:** present Worker checks current Firestore HA PRIMARY before `claim/stage/preview/publish`, while Agent additionally checks primary before each upload. The current per-job lease is not equivalent to the independent durable job grant now required. On Office-only network the Worker cannot be contacted directly *before* WMS export/network switching: a scoped trustworthy pre-admission path is mandatory to honor "job survives loss of PRIMARY from start". Evaluate one limited existing Google Gateway pre-admission versus a verified immutable start-intent in already registered Firestore coordination. Never trust solely an Agent-supplied old generation, leak WMS credentials, or authorize an unknown resource. See D168-E016 and `docs/D168_AGENT_SKU_JOB_WIFI_ROUTING_OWNER_2026-10-13.md`. No Agent/Worker/Android code or release authorized by this spec entry.


## D168-E018 — SKU FULL 05h bắt buộc, direct Cloudflare Worker (Owner approved code + Beta)

- FULL đầu ngày đúng ngày Việt Nam là bắt buộc; không đợi có standby để chạy nếu chỉ một PRIMARY. Nếu Agent xuất hiện sau 05:00 mà chưa có FULL DONE, ưu tiên hoàn thành khi không có WMS confirm đang thao tác; nếu toàn bộ đường mạng không sẵn sàng thì fail-closed, cảnh báo và retry có giới hạn, không giả DONE.
- Nguồn SUPRA WMS được Owner xác nhận truy cập qua mạng thường; trên máy triển khai phải thử đường WMS HTTPS signed GET, Firestore và Worker thật trước khi quyết định mạng. Không tự đi vòng giới hạn mạng công ty. Nơi mạng thường đã dùng được cả WMS và Worker, ưu tiên giữ một mạng để FULL và DELTA.
- Thủ tục mới: Worker Firebase Agent auth → xác minh PRIMARY khi reserve → InventoryCore cấp lease/job grant có dấu xác thực, scope ngày/slot/actor/instance → Agent đọc XLSX WMS an toàn → stage/preview/publish → Worker Core durable receipt DONE kiểm fingerprint và trạng thái ngày. Quyền job hợp lệ độc lập sau khi HA đổi PRIMARY, nhưng không cho PRIMARY mới tạo job thứ hai khi job cũ còn hiệu lực.
- Không dùng Apps Script Gateway cho bất kỳ request SKU nào (scheduled/manual/status); phải chứng minh qua source test. Giữ FULL atomic membership/hide/protected Web edits/large-hide preview/receipts và DELTA 12h/19h skip-idempotency như D167.
- Tiết kiệm quota bằng không stage khi semantic fingerprint giống dữ liệu nguồn đã kiểm, không poll liên tục, một job một chủ, không phát hot progress qua Firestore đến mọi Agent.
- **Release gate:** chính sách đã được Owner chốt, D168 code đang viết ở PR591; chưa PASS toàn bộ hoặc triển khai. Stable owner-gated không đổi.

## D168-E022 — Agent v131: đường Worker Beta trực tiếp và biên nhận DONE dùng kênh đồng bộ Agent hiện hữu

Trên nhánh D168 đang xét, code Beta đã gắn `D168NetworkRoute` vào luồng cập nhật SKU tự động và thủ công. Nếu đường Worker trên mạng hiện thời không kết nối được (chỉ lỗi DNS/kết nối/timeout; không tự quy 401/403/429 là mất mạng), Agent kiểm tra mạng Wi-Fi đã lưu/được chọn, xuất Excel WMS HY1 ở chế độ chỉ đọc **trước khi đổi Wi-Fi**, sau đó mới kiểm tra Worker qua GET có xác thực và xin phép chuyển mạng. Hộp thoại không khóa luồng Confirm, cho 60 giây; không phản hồi chỉ có hiệu lực đối với quyền **thử đổi mạng** khi đang rảnh và HA vẫn hợp lệ. Khi hoàn tất/lỗi cần quay về mạng cũ, xác minh tên profile và phát hiện thất bại. Không giữ credential/WMS token/SSID trong nhật ký công khai.

Với thao tác thủ công, tải WMS trước khi đổi mạng nếu Worker bị chặn không phải xác nhận đã cập nhật. Mật khẩu/mã đặc quyền vẫn được **Worker xác minh tại manual-start và reserve trước khi stage/publish**, dữ liệu đọc thử phải bỏ nếu xác thực thất bại. Khi không có fallback Wi-Fi đã lưu, không xuất WMS lặp lại mỗi lần retry. Lượt cập nhật qua 00:00 phải abort đúng ngày đã cấp lease.

Một biên nhận `DONE` đã được Worker/InventoryCore xác minh mới được phản ánh đến Agent khác: chỉ gửi tóm tắt terminal ngày/slot, không truyền row/bin/product hoặc từng stage. Dùng chính tài liệu `agent_sync` và listener Firebase hiện có; khi cạnh tranh ghi, hợp nhất các slot DONE thay vì làm mất kết quả trước. Thông tin từ kênh Agent là bản tóm tắt hiển thị; Worker/Core tiếp tục là source-of-truth; không dùng Firebase làm dữ liệu SKU chính. Giữ ít lượt ghi và cấm polling riêng.

Agent Beta ứng viên **v131**, quyền phát hành D168 sử dụng receipt mới mặc định khóa (code-only), không thể lấy nhầm ủy quyền D167. **Chưa xác minh FIELD PASS** trên PC Office/PDA, FULL 05h một máy, WMS Confirm/HA và readback Worker DONE. Không được chuyển trạng thái release-pass chỉ bằng source CI, không được đụng Stable.

Chứng cứ: PR #591, `relay-agent/D167SkuCoordinator.cs`, `D168NetworkRoute.cs`, `D168SkuSharedState.cs`, `FirestoreAgentSync.cs`, `tools/d167_release_gate.py`, `ops/d168-release-authorization.json`; D168-E022.

## D168-E036 — Mạng Wi-Fi đã lưu theo ưu tiên và bất biến DONE giữa Agent (Beta candidate)

- Agent liệt kê hồ sơ Wi-Fi đã lưu trong Windows theo thao tác người dùng, cho chọn tối đa 6 mạng theo thứ tự cố định; lưu riêng HKCU không lưu mật khẩu. Không tự tạo Wi-Fi và không vượt chính sách mạng công ty.
- Khi Worker bị lỗi mạng thực (không phải 401/403/429/5xx), mới kiểm tra điều kiện HA/Confirm và hỏi phép chuyển mạng theo chính sách 60 giây đã chốt. Thử từng mạng đã duyệt theo ưu tiên, chỉ khi khôi phục và xác minh mạng gốc thành công mới thử lựa chọn kế tiếp. Nếu không khôi phục được thì fail-closed; không giả DONE.
- Kênh Agent Firestore hiện hữu sử dụng optimistic CAS theo updateTime cho SKU DONE; cùng ngày/slot giữ biên nhận đã xác minh đầu tiên, merge các slot độc lập và không được làm mất biên nhận cũ khi payload vượt giới hạn. Worker/Core là nguồn sự thật; không thêm Firestore poll/listener hoặc Google Apps Script SKU.
- Nguồn ứng viên PR592 SHA 4a7282b0ba89c26c5b35ab0166dc17f76543e43e; chưa có FIELD PASS Windows WMS/Office/single-primary/HA/ACK hoặc bản phát hành PR592 tại thời điểm checkpoint. Stable không được phép.


## D171-E047 — D: SKU hot reads use DO-authoritative single-invocation auth (CODE ONLY)

Existing `/api/skus`, `/api/skus/catalog-info`, `/api/skus/catalog`, `/api/skus/catalog-delta` and Web-only `/api/admin/skus/catalog-provenance` retain public payload, pagination, delta/full reconciliation, roster and local Android SQLite rules. Worker checks Firebase JWT and calls an internal `/authorized/.../skus` path; **InventoryCore** verifies current effective role, active session generation and account status in that same invocation, then reads its original SQL data. Catalog provenance remains admin-scoped and Android-blocked. No D1, KV, browser edge session cache, new database or client poll. Old internal routes remain only for established compatibility until an authorized release gate. Actual DO request reduction and unchanged UI/PDA time are pending real measurement.
