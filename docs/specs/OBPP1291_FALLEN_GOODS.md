# D172 — Ghi nhận hàng rớt OB × PP1291

Status: OWNER_APPROVED_ISOLATED_CODE_ONLY; new native Google Sheet created, app/backend not deployed.

## QR and fields
- Format: STORE|DO|SO|PACKAGE|AREA|INDEX/TOTAL, 6 nonblank parts; index and total positive integers, index <= total.
- Sample 2BPB|7083772047|SOWINSAJREM3B84|PB1261009080B99.004|CX1.10.1|1/4 -> store 2BPB, DO 7083772047, ordinal 1, total 4.
- Save raw original QR, store uppercase, DO string of digits (preserve leading zeros), total integer, selected active location uppercase, timestamp from trusted server in VN timezone.
- Keyboard-wedge/PDA scanner Enter parses only; submit is an explicit Save to avoid accidental inserts.

## Roles & sessions
- Allowed real/current roles ADMIN, PICKPACK_ADMIN, ROOT; deny PICKER/REPORTER, anonymous, revoked, kicked, disabled and stale-role sessions.
- Authenticate via separate OBPP1291 session namespace; do not call existing Web/Android login that increments shared interactive generation. Independent logout.
- App never writes GSheet directly. All endpoints verify Firebase-linked server authority and OBPP session on each request. No secrets/Sheet ID/SA JSON in APK or public repo.

## Client
- Android app cd.cc.supra.obpp1291, separate Gradle module and signing/update. Tabs Nghiệp vụ and Danh sách vị trí.
- CRUD operations for scan records and locations; form supports manual correction with server validation and optimistic expected_revision. Location deletion archives, preserving history.
- Long press scan history shows Edit / Delete; deletion is a tombstone, not physical erasure. List status distinguishes backend saved and Sheet sync pending/confirmed/error.
- No offline business outbox, only read-only last available display if ever added.

## Sheet schema
- Ghi_nhan: ID; Ngày; Scan QR; Mã cửa hàng; DO; Số kiện; Vị trí; Thời gian; STT kiện; Người thao tác; Trạng thái; Phiên bản; Cập nhật lúc.
- Vi_tri: Mã vị trí; Trạng thái; Người cập nhật; Cập nhật lúc.
- Nhat_ky: Mã sự kiện; ID bản ghi; Thao tác; Phiên bản; Thời gian; Người thao tác; Ghi chú.
- Text-safe values: neutralize leading = + - @ against formula injection. Timezone Asia/Ho_Chi_Minh; date dd/MM/yyyy, time HH:mm:ss.

## Backend source contract — proposed, NOT live
- POST /api/obpp1291/session/login: verify current real user/password with existing InventoryCore credentials but issue only OBPP-specific session without bumping WEB/ANDROID/AGENT generation; response session_token, role, display_name. Rate-limit and revoke on account disable/password change.
- GET /api/obpp1291/locations; POST /locations; PATCH /locations/:code.
- GET /api/obpp1291/records?limit=50; POST /records; PATCH /records/:id; DELETE /records/:id.
- Mutations have operation_id UUID, expected_revision on edits and delete, and server-generated ID/time/actor. Deduplicate operation_id with transaction. Conflicting revisions return HTTP409.
- Store records, mutations, and durable Sheet outbox atomically under an isolated OBPP namespace; never reuse shortage/picklist IDs or queries. GSheet operations are idempotent by record ID/revision; 429/5xx bounded retry/backoff; status PENDING/SYNCED/ERROR with no fake success.
- Prefer push/delta realtime; no per-user heartbeat/Sheet polling. A small coalescing window for Sheets low usage; measure p95 under comparable field load, no hard seconds SLA without proof.
- New Sheet is private and requires explicit runtime service identity access, not guaranteed by connected Drive account.

## Acceptance
- Valid 1/4, 3/3, 1/1; invalid 0/4, 5/4, incomplete/non-digit, formula string, overlong, leading-zero DO.
- 2-user concurrent edit 409, double scanner Enter, duplicate operation retries, offline/reconnect, 429 retry, Sheet permission loss, midnight VN, location rename/archive.
- Role positive and negative, OBPP independent session, no logout of active Agent/Inventory sessions, no public provider auth bypass.
- Source CI and Android debug assemble PASS separately from signed APK/field/Sheet sync/Owner PASS.

## Release guard
- New Sheet created and checked. No live backend/worker source route, outbox, Firebase login scope or writing service installed. D172 remains code-only; Owner approval needed for a provider mutation/release after resource and security review.

## D172-E006 Owner release + updater

- Owner yêu cầu cập nhật GitHub Releases hiếm (1–2 PDA), kiểm tra khi mở/manual; gói APK package D172 riêng, ký số cố định, SHA-256. Không thay đổi manifest/kênh OTA Inventory.
- D172 không tự đóng sau code, release hoặc FIELD PASS; chỉ Owner có thể yêu cầu đóng D172 và mở Dxxx mới.
- Code scope được Owner cho phép: handler độc lập trên Worker đã đăng ký và các bảng `obpp_*` trong existing InventoryCore SQLite; không thay business Báo hàng và Confirm Picklist.
- Service account đã được share Writer sheet D172, quyền Google vẫn cần runtime proof. Sheet identity chọn bằng Drive metadata exact title + SHA-256 fingerprint ID, fail-closed nếu khác hoặc không có. Có thể bổ sung private runtime var để tăng tốc; không commit Sheet ID/secret.
- Data: ghi giao dịch DO SQLite trước; outbox claim/lease và audit, sync Sheet event-driven có đối chiếu ID ngăn duplicate, nếu Google lỗi thì giữ PENDING, không trả SYNCED giả.
- Nghiệm thu: PR exact source + CI / worker health / private Sheet actual write / Android signed channel / kiểm thử MT90/DT50 đều riêng; FIELD/Owner PASS chưa mặc nhiên.
