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


## D172-E010 — Field login HTTP500 remediation (22/10/2026)

- v1 FIELD FAIL: attempted shared Firebase SUPRA Inventory account login returns HTTP500, no Owner acceptance.
- Strict account mapping: only existing active InventoryCore user with matching Firebase UID and effective/base role ADMIN, PICKPACK_ADMIN or ROOT; do not grant access just because an arbitrary Firebase Auth account exists.
- Non-privileged login follows the same `ensureFirebasePasswordReady` and fallback legacy-password migration as Inventory Web; privileged root/admin/tamnv2/vps obey the existing one-time-code policy and may request a code via existing `/api/auth/privileged-code`. Passwords/one-time codes are never stored in new app or repo.
- D172 OBPP-specific session generation must not activate or displace Inventory WEB/ANDROID or AGENT session generations.
- Invalid credentials must yield 401, insufficient role 403, operational unavailable cases bounded 503 with non-sensitive stage code; no generic HTTP500 without diagnostics. UI shows an allowed server error code without raw stack/body.
- Production deployment accepted by Owner in D172-E010 is scoped to the existing Worker login handler plus separately signed OBPP Android APK; require exact SHA receipt, all code/authority CI, Worker `/health.source_commit` equal protected merge commit, OBPP status `READY/SCOPED_CONNECTED`, unauthenticated negative login 401 before publishing v2. This is not evidence of valid-user login success or Sheet writes, both require real field testing.


## D172-E012 — Firebase UID có dấu `:`

InventoryCore tạo tài khoản được quản lý với user_id/Firebase UID role-prefixed như `admin:<username>` và `pickpack_admin:<username>`. Endpoint `/obpp1291/session/activate` phải chấp nhận những Firebase UID hiện hữu này (độ dài tối đa 128, ký tự ASCII trong tập cho phép), thông qua SQL tham số; không tự tạo/chuyển mã UID. `session/check` xác minh cùng UID/generation và hoạt động độc lập với WEB, ANDROID, AGENT. Hồi quy: test trực tiếp handler activation/check cho tài khoản hợp lệ có dấu `:`, lặp login tăng generation, phiên cũ revoked, chuỗi lệnh SQL/control bị từ chối. E012 chỉ triển khai Worker trên existing official host, không nâng APK v2. FIELD PASS đòi hỏi đăng nhập thực trên máy của Owner và kiểm tra QR/Sheet.

## D172-E014 — Ghi nhận/đồng bộ và UI sau field fail (Owner approved 22/10/2026)

- 100 DO/ngày và 1–2 PDA là quy mô thiết kế. Người dùng lưu QR/ vị trí chỉ thành công khi authoritative SQLite transaction committed, không trả Sheet SYNCED nếu chưa nhận ACK từ Google. Có 3 trạng thái tiếng Việt: `SYNCED → Đã đồng bộ`, `PENDING → Đang đồng bộ`, `ERROR → Lỗi đồng bộ`; ERROR không làm mất outbox và vẫn thử lại.
- Ghi Sheet theo thao tác, index first-column cache theo mỗi batch, một drainer lease trên obpp_* SQLite, giới hạn lô; trường hợp 429/5xx/timeout tự retry trên lịch cron 5 phút đã đăng ký. Không tự thêm Cron, không Apps Script UrlFetch trong đường nóng. Manual `POST /api/obpp1291/sync` xác thực phiên OBPP, cập nhật trạng thái/lấy dữ liệu lại.
- Đồng bộ ngược bằng Drive `modifiedTime` + Sheets API scope của SA hiện hữu, tối đa lịch cron 5 phút, nút thủ công có thể force; chỉ áp dụng chỉnh sửa bản ghi có ID, `revision` khớp và Core `SYNCED`. Sửa mã cửa hàng/DO/số kiện/vị trí/raw QR/STT hợp lệ ghi audit `SHEET_EDIT`, Core revision tăng, enqueue lại. Không nhập dữ liệu vô danh từ Sheet, không override row PENDING/ERROR hoặc revision không khớp. Vị trí có `sheet_key` ổn định ở cột E và `revision` cột F; v1–v2 tự backfill 3 vị trí cũ qua outbox có audit. Nhãn trạng thái nguồn Google phải là `Đang sử dụng` hoặc `Ngừng dùng`. Trường hợp conflict giữ server, chờ xử lý thủ công.
- **Không hứa Google Sheet -> app tức thời trong mọi tình huống.** D172-E014 không tạo Apps Script project/trigger mới ngoài project-scope. Webhook `onEdit` được Owner duyệt về mặt phương án nhưng chỉ được kích hoạt khi resource identity/trigger đã đăng ký và bảo vệ chữ ký, authority+scope cùng PR. Phương án đang code: có thay đổi Sheets thì đối soát theo lịch hiện có hoặc bấm nút thủ công; không tạo polling từng PDA và không ảnh hưởng Pickface Damage UrlFetch.
- UI nhãn Mã cửa hàng, DO, Số kiện nằm ngoài field, input trống không placeholder; scan QR vẫn tách thông tin và người dùng bấm Lưu. Danh sách history chỉ có record chưa deleted, ngày VN dd/MM/yyyy HH:mm:ss; cho checkbox chọn nhiều, Chọn tất cả, Bỏ chọn, xác nhận Xóa đã chọn. Backend bulk-delete một transaction tối đa 100 với operation_id chống lặp + expected_revision CAS cho từng bản ghi, tombstone và audit Sheet.
- Hồi quy bắt buộc: nhiều PDA tạo vị trí cùng lúc không nhân đôi; 429/403 Google; cùng DO QR scan rapid; retry sau tắt app; vị trí Sheet rename/active; record Sheet edited revision conflict; cùng lúc app + Sheet sửa; batch delete 0/1/50/100, logout/token 401, old APK v2 tương thích backend, time VN qua ngày mới; số request Sheets và DO mỗi 100 DO đo sau rollout. Chỉ technical CI PASS không đủ coi là physical Google write FIELD PASS.
