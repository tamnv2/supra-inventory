# D172 — Ghi nhận hàng rớt OB × PP1291

Status: D172 Owner-approved isolated app/backend. Signed OBPP v2 + existing Worker E012 previously deployed; E014 PR #676 23/23 CI PASS, protected main merge 35c3dcbc and signed obpp1291-v3 tag observed; live asset/channel and FIELD/OWNER PASS still require proof.

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

## Backend source contract — D172 implemented; E014 reconciliation is PR-only until protected release
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
- Existing Sheet verified; D172 Worker routes and private SQLite tables previously deployed; signed OBPP v2 is in production. All E014 mutations remain PR-only until scoped approval receipt, CI, merge, exact Worker readback and separate signed APK. No new resource, Stable or Inventory app release. Owner FIELD PASS remains pending.

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

## D172-E016 — Google Sheets ValueRange update hotfix (22/10/2026)

- Khi ghi cập nhật một vị trí/bản ghi đã có, JSON `ValueRange.range` và URL `spreadsheets.values.update` dùng cùng A1 range có quote tên tab và đủ cột A:F/A:M; khác range là lỗi thử nghiệm và không được ACK `SYNCED` giả.
- Khi append cũng gửi `range` trùng path append. Test thực thi giả lập Google phải chặn mọi request có body.range khác URL và chứng minh update không chèn dòng trùng. Không thay đổi OBPP v3 APK; chỉ bản Worker mới phải vượt guarded release.
- Không tự coi PR CI hoặc tag APK là xác nhận ghi vào private Sheet; yêu cầu quan sát Google Ghi_nhan/Vi_tri/Nhat_ky thực, lỗi/retry, Apps Script quota và thử dữ liệu trên PDA.

### D172-E016: timezone và nghiệm thu thực tế (22/10/2026)

- UTC ISO là chuẩn lưu trữ trong Core; mọi trường thời gian hiển thị cho nhân sự trên Google Sheet `Ghi_nhan!M`, `Vi_tri!D`, `Nhat_ky!E` phải là chuỗi `dd/MM/yyyy HH:mm:ss` timezone Việt Nam (UTC+07); ngày và giờ nghiệp vụ `Ghi_nhan!B/H` vẫn lấy từ time VN trên Core. Không dịch UTC hai lần và không thay giá trị timestamp nguồn.
- 8 ô thời gian cũ thực tế trên native Sheet đã chuyển sang giờ VN và được đọc lại xác nhận. Ở thời điểm kiểm tra `Ghi_nhan` chỉ có header, `Vi_tri` bốn vị trí; chưa có bằng chứng field sync QR pass. `Lỗi đồng bộ` là FAILURE không được hiển thị `Đã đồng bộ` giả. Worker's exact A1 update writer E016 được scoped PR CI và Production deploy kiểm soát; cần proof backend và real-sheet qua authenticated PDA app.


## D172-E018 — UX A · Cloud authoritative · Sheet one-way mirror · Điều phối Pick Pack (Owner 22/10/2026)

### Phạm vi và thiết kế
- D172 là ứng dụng tạm thời độc lập theo chức năng “Ghi nhận hàng rớt”, cùng existing Cloudflare Worker/InventoryCore/Firebase identity với Báo hàng nhưng chỉ mở rộng D172-scoped API `/api/obpp1291/*`, SQLite `obpp_*` và Android package/channel D172. Không thêm Worker/DO/Firebase project/GAS và không chạm Báo hàng, Agent, Confirm Picklist, stable.
- D172 được giữ mở đến khi Owner chốt đóng. Mọi yêu cầu D173/khác sau khi D170/D171 hoàn thành phải ở workstream riêng, không gộp D172.
- UI phương án A “Enterprise Blue”: nền sáng/xanh navy, typography rõ, khoảng chạm phù hợp PDA, nhãn Mã cửa hàng/DO/Số kiện **ngoài ô**, ô trống không placeholder rối, cụm QR, nút Lưu nổi bật, lịch sử có checkbox/chọn tất cả/xóa nhiều, badge Đã đồng bộ/Đang đồng bộ/Lỗi đồng bộ, tab vị trí thêm/đổi tên/ngừng dùng. Giữ parser scanner-wedge+Enter và bước Lưu tường minh; mockup máy ảnh chỉ là tham khảo thẩm mỹ, không bổ sung camera scanner. Màn hình đăng nhập hỗ trợ mã một lần khi thực sự áp dụng, thông báo lỗi ngắn. Không hiện text “Owner”, “AI”, hướng dẫn kiến trúc/CI/GitHub hệ thống hay developer trace cho nhân sự. Chỉ giữ tác vụ, trạng thái, lỗi hữu ích và xác nhận hành động phá hủy.
- Chưa có Owner authorization triển khai giao diện A và role mới lên runtime tại checkpoint này; bắt đầu code sau impact review cụ thể theo gate hiện hành.

### Quyền và phân tách user
- Firebase và InventoryCore managed-user là nguồn tài khoản duy nhất. Thêm “Điều phối Pick Pack” dưới dạng năng lực hẹp chuyên D172 (không đồng nhất với `PICKPACK_ADMIN`). Có thể cấp từ màn hình quản lý người dùng trên Web Báo hàng bởi nhân sự được phép quản trị; tài khoản Điều phối không đăng nhập/sử dụng Web, Android Inventory, Agent hoặc Picklist.
- Cấm triển khai bằng cách chỉ ẩn mục menu. Phải cập nhật server-side login allowlist, `requireUser`, quyền endpoint, Firebase custom claims/session-channel, effective/base role check; không cho một account mới đạt quyền qua email/Firebase-only, không làm thay đổi generation các kênh WEB/ANDROID/AGENT hiện có. OBPP session là kênh riêng.
- Đề xuất kỹ thuật cần impact review: role chuyên biệt `OBPP_COORDINATOR` mặc định deny mọi kênh ngoài OBPP, giữ Admin/Root/authorized quản trị viên tạo từ Web qua endpoint account provisioning hiện có với whitelist hẹp. Tránh cấp `PICKPACK_ADMIN` để “login được D172” vì đồng nghĩa thêm quyền Agent/Web. Quyền chính xác của người cấp và quy tắc chuyển/khóa/mật khẩu phải được review trước mutation. Không tự đổi schema chung nếu chưa rà soát đầy đủ.
- Kiểm thử: Điều phối đăng nhập D172 PASS, thử `/api/auth/login` cho WEB/ANDROID hoặc Agent FAIL ở backend, dù gọi API trực tiếp; các vai trò hiện tại không mất quyền; đổi/khóa/mất phiên D172 chỉ ảnh hưởng kênh riêng; tạo account không kick các phiên đang chạy.

### Google Sheet chỉ đọc và luồng dữ liệu
- **Authoritative**: giao dịch ghi Core SQLite atomically + immutable audit + outbox. **Mirror**: Ghi_nhan/Vi_tri/Nhat_ky phản ánh Core, không quyết định quyền hay trạng thái kinh doanh.
- Xóa/cấm `reconcileObppSheetEdits` Google→Core trong nút `/api/obpp1291/sync` và scheduled cron; chỉ Core→Sheets. Core không nhận `SYSTEM_SHEET` edits nữa. Nếu người có quyền Editor chỉnh Sheet, phần thay đổi không thể được nhập ngược, phải tự phục hồi qua so sánh id/revision/content và batch repair Core→Sheet; Viewer không có quyền sửa. Cần thiết kế cẩn thận khi phục hồi dòng bị xóa/thay đổi thứ tự/đổi ID để tránh duplicate, giữ audit Core.
- Quản lý access Sheet: cấp Viewer cho người xem, service account Writer; có thể protected ranges để bảo vệ trước thao tác vô ý của editor. Không public-link Editor. Tạo/chỉnh quyền Google Sheets/Drive chỉ sau permission/scope review rõ ràng.
- Bỏ `resolveObppSheetId` hard readiness gate trước mọi `/api/obpp1291/*` request; auth, CRUD luôn phụ thuộc Core/Firebase, không phụ thuộc Sheets; sync riêng báo lỗi/PENDING rõ ràng. Cập nhật có event-driven drain `ctx.waitUntil`, một lease/capped batch, retry backoff ở existing 5 phút cron, không thêm GAS/trigger/consumer polling. Không hứa 0 giây; throttle batch trước Sheets quota 60 writes/min per SA, tránh chặn hoạt động Core.
- Đối soát: cột key/revision + immutable id, định kỳ hoặc on-demand kiểm tra drift; khi không có đổi Core nhưng Sheet bị sửa trực tiếp vẫn phải phục hồi (không chỉ drain outbox rỗng). Đối soát theo batch/chunk để tránh đọc full-sheet mỗi lần/cron; không xóa bản ghi Core hay tái nhập dữ liệu Sheet. Offline vẫn không lưu nghiệp vụ.
- Thực trạng trước E018: `service/src/index.ts` gọi `reconcileObppSheetEdits` ở sync API và cron; `service/src/obpp1291-core.ts` chấp nhận `SYSTEM_SHEET`; `resolveObppSheetId` chạy trước cả login. `drainObppSheets` đã event-driven+retry, max 30 events/invocation với index theo tab. E018 không mặc định đã được runtime áp dụng.

### Usage tham chiếu, cần đo sau rollout
- Tải thiết kế ~100 DO/ngày, giả định 1–4 QR/DO => 100–400 record/ngày, khoảng 3.000–12.000 record/30 ngày. Mỗi record tạo ít nhất RECORD và AUDIT outbox events; Sheet khoảng 200–800 writes/ngày (6.000–24.000/tháng) trước chỉnh sửa/retry và vị trí. Đối soát/batch chỉ đọc theo thay đổi để giới hạn request Google, không tạo read loops.
- Worker API, DO compute request, DO duration, SQLite rows written/read shared account/project với Báo hàng. Khung ước lượng bước đầu khoảng 5–15 DO requests / bản ghi cộng phiên xem lịch sử và cron/fail retries => 500–6.000 DO calls/ngày trước các nghiệp vụ khác. Đây là **ước lượng thiết kế**, không phải Billing field measurement. Cần thống kê riêng per-route bằng counters/event-source hiện có, không lưu raw QR/PII và không thêm synchronous telemetry SQL per scan, sau đó so sánh với usage cả tài khoản và quota shared.
- Google Sheets API: giới hạn mặc định 60 read + 60 write/phút trên mỗi user/service account và 300/phút/project, có thể HTTP429; dùng batch coalescing/rate-limit/backoff. Cloudflare Workers Paid 10M requests/tháng kèm phí nền và DO 1M requests/tháng gồm cả toàn bộ app trong tài khoản; không khẳng định chi phí tăng bằng 0 khi chưa có bill/DO duration field proof.
- Gate trước code: phân tích chức năng common account provisioning và auth deny-by-default, ràng buộc data/schema/release; không thay code Báo hàng/Picklist trừ đường quản trị danh tính được Owner yêu cầu, và chỉ qua D172 review, source CI, protected PR, release receipt, Owner physical verification. D170/D171/Stable tách riêng.

## D172-E022 — Owner chỉnh sửa 13 yêu cầu về vị trí, lịch sử, Google Sheets (22/10/2026)

**Trạng thái:** yêu cầu Owner đã chốt, CODE-ONLY CANDIDATE. Chưa đổi dữ liệu Sheet, chưa cấp quyền mới, chưa triển khai; D172 không tự đóng, D170/D171/Agent/Báo hàng/Stable không thay đổi.

### UI Android D172
- Ba tab ghim cố định dưới cùng: Nghiệp vụ – Vị trí – Lịch sử; tab chọn nổi bật. Lịch sử chuyển hẳn khỏi Nghiệp vụ; tự làm mới trạng thái không làm mất draft hoặc nhảy về đầu màn hình.
- Lịch sử hai dòng: dd/MM/yyyy HH:mm:ss của lần tạo đầu tiên; dòng 2 MCH | DO | N kiện (TỔNG, không phải STT kiện) | Vị trí. Nền SYNCED xanh nhạt, PENDING vàng nhạt, ERROR đỏ nhạt. Không hiển thị chữ trạng thái trong item; có mô tả accessibility.
- Dùng cùng mẫu checkbox và thanh Chọn tất cả/Bỏ chọn/Xóa đã chọn cho Lịch sử và Vị trí, hỗ trợ 1/nhiều/tất cả, xác nhận hủy dữ liệu, CAS cho đồng thời.
- Vị trí chỉ Thêm/Sửa/Xóa; không hiển thị trạng thái đang sử dụng/ngừng dùng. Spinner Vị trí nằm cùng hàng với nhãn, căn giống các trường Mã cửa hàng/DO/Số kiện.
- Tạo bản ghi thành công mặc định focus trở lại Scan QR. Nếu QR mờ, cho phép bỏ trống QR và nhập MCH/DO/tổng số kiện/vị trí; lưu raw_scan là Người dùng nhập thủ công, parcel_index=null. Scanner-wedge/Enter + parser hợp lệ vẫn giữ.
- Màu nền cập nhật khi trạng thái Service đổi mà không cần bấm nút đồng bộ; dùng cơ chế foreground bounded/delta thích hợp, không thêm polling nền liên tục/FCM/Firebase Rules. Nút thủ công chỉ dành cho retry; không tuyên bố websocket realtime hoặc SLA chưa đo.

### Service và Google Sheets
- Core SQLite là nguồn duy nhất; CRUD thành công và sheet mirror là hai trạng thái khác nhau; Core phát outbox, Google ACK quyết định sync_status. Lỗi 429/5xx/backoff/lease không mất bản ghi và không duplicate.
- Đổi tên tab của đúng spreadsheet scope: Ghi_nhan => Ghi nhận Rớt; Vi_tri => Vị trí; Nhat_ky => Nhật ký thao tác. Phải phối hợp code Worker và dữ liệu Sheet, không rename trước khi backend chấp nhận.
- Ghi nhận Rớt chỉ còn 10 cột theo thứ tự: ID, Ngày, Thời gian, Scan QR, Mã cửa hàng, DO, Số kiện, Vị trí, Người thao tác, Cập nhật lúc. Ngày/Thời gian = lần CREATE đầu tiên (VN); Cập nhật lúc = sửa cuối (VN). Người thao tác = tên hiển thị của người dùng đã xác thực, không thêm role/prefix.
- Lỗi đã chứng minh từ metadata: Ghi_nhan freeze 7, header nằm hàng 7 trong khi dữ liệu ghi trên header. Phải normalize header hàng 1, freeze 1, giữ các record thực có ID, schema 10 cột, xác minh duplicate; ghi mới luôn append dưới dữ liệu, không ghi đè dòng hiện tại. Không xóa dữ liệu lịch sử để sửa header.
- Xóa lịch sử là hard-delete obpp_records và deleteDimension dòng Sheet theo ID; không để soft-delete và không xuất chữ Đã xóa. Chỉ giữ audit tối thiểu không chứa QR và bản ghi delete-intent/idempotency cần thiết để thử lại đến khi Google ACK. Xử lý delete-before-append, retry/trùng, stale revision, CAS all-or-none batch <=100; không tái tạo dòng Sheet đã xóa từ outbox hoặc drift repair.
- Xóa vị trí một/nhiều/tất cả hard-delete obpp_locations và dòng tab Vị trí. Bản ghi lịch sử trước đó vẫn giữ chuỗi tên vị trí; vị trí xóa không được phép chọn để lưu mới. Khi tái tạo trùng tên, generation/delete event cũ không được xóa bản mới.
- Google Sheets chỉ bản sao một chiều Core→Sheet; mọi sửa trực tiếp trên Sheet được đồng bộ phục hồi từ Core, tuyệt đối không ngược lại. Trước migration/deletion cần snapshot, kiểm tra Sheet metadata và quyền, backup/readback; không commit/log raw QR hoặc staff data.

### Ma trận ảnh hưởng và nghiệm thu
- Phạm vi code: obpp1291 Android, service/src/obpp1291-core.ts, service/src/obpp1291-sheets.ts, tuyến API riêng và header tên người thao tác đã xác thực, CI/test/release receipt. Không đổi luồng Agent, Picker/Reporter/Inventory Web, WMS, Firebase rules, Stable hoặc OTA Báo hàng.
- Tests: QR/manual, ghi 1/100/400, loại trừ STT kiện; Google 429/503; header sai row7 & record row1..6; append, edit, delete 1/50/100; vị trí CRUD concurrent; idempotency/retry; Sheet sync race vs delete; stale expected_revision; timestamp VN create/update; chữ/tên Actor; app foreground/resume/background/selection/scroll; older APK v3/v4; auth Coordinator vs Inventory deny.
- Thứ tự deploy an toàn: PR source + authority/continuity CI => exact SHA guarded Worker backward-compatible => migration private Sheet & verify headers/rows => separate signed OBPP APK => field QR-delete-status proof. Nếu không có cơ chế rollback hoặc backup, giữ CODE-ONLY không triển khai hủy dữ liệu. FIELD/OWNER PASS luôn cần Owner nghiệm thu.

## D172-E026 — 6 lỗi phát sinh v5, sửa cùng D172 (22/10/2026)

1. **Tab Lịch sử**: khi bấm phải render ngay; refresh async giữ tab/scroll và trạng thái chọn. Lỗi v5: chuyển tab chỉ gọi GET và chỉ rerender khi dữ liệu thay đổi, tab trống nếu JSON bằng bản đang có.
2. **Icon**: icon riêng OB × PP1291 dùng hình thùng hàng rớt và định vị/cảnh báo, không dùng icon Android mặc định; build signed cùng package hiện tại.
3. **Đăng nhập**: danh tính/mật khẩu kiểm tra qua Firebase/InventoryCore hiện có. Phiên D172 riêng là chuỗi ngẫu nhiên 256-bit, lưu duy nhất SHA256 trong Core và mã hóa Android Keystore ở thiết bị, **không hết hạn theo đồng hồ**. Mỗi user chỉ một phiên D172: đăng nhập thiết bị khác hủy phiên cũ; tự logout hủy; tài khoản bị khóa hoặc đổi mật khẩu hủy. Không áp dụng sang Inventory Web/Android, Agent, Picklist. JWT D172 v5 cũ chỉ chấp nhận đến khi hết hạn tự nhiên, không tái cấp.
4. **Trạng thái đồng bộ**: PENDING không có nghĩa Sheet chưa có dữ liệu. Worker ACK khi Google ghi thành công, Core cập nhật SYNCED. Khi Sheet có đúng ID + giá trị phiên bản nhưng ACK bị gián đoạn, đối soát từ Core→Sheet xác nhận qua endpoint Core nội bộ, không tạo lại dòng; App tự làm mới foreground lúc pending (5s) hoặc ổn định (30s). Không coi HTTP tạo thành công là Google ACK, không claim realtime ngay khi Android background. Màu nền xanh/vàng/đỏ theo Core thực.
5. **Log**: App riêng ghi sự kiện chức năng, lỗi HTTP, thời gian đáp ứng, thông tin phiên bản/PDA và chỉ số usage cơ bản, **không ghi QR, MCH, DO, tài khoản, mật khẩu, token hoặc giá trị bản ghi**. WorkManager một lần mỗi ngày 21:15 giờ Việt Nam (có thể lệch do Android Doze), một lần thử lại sau 15 phút; vẫn lỗi thì giữ local và gửi lại cùng log ngày kế tiếp. Nút Gửi log ứng dụng trong menu cùng Kiểm tra cập nhật/Đăng xuất. Dùng chính Runtime Logs Core+Drive thư mục log Báo hàng và phân ngày đã đăng ký; file chứa tiền tố obpp1291 cùng payload.project OBPP1291, tuyệt đối không cấp tài khoản Google trên PDA. Chỉ xóa bundle trên PDA khi server trả DRIVE_SYNCED; BUFFERED không đủ điều kiện xóa. Dữ liệu log cá nhân/vị trí nhạy cảm phải được lọc.
6. **Đồng bộ thủ công**: popup xác nhận trước khi gọi; chặn double-click, có cooldown 60s ở App và kiểm soát bền vững 60s theo user trong InventoryCore, trả 429 + retry_after_seconds, không chạy Google repair khi bị từ chối. Tự động outbox/crons không chịu cooldown này và không cần xác nhận.

Triển khai đúng trình tự branch → PR → Source/Authority/Continuity PASS → exact source pin → protected merge → existing scoped Worker health SHA + session/sync tests → signed OBPP v6 APK + GitHub OTA → Owner field test. D172 vẫn mở và Owner FIELD PASS chỉ khi Owner xác nhận; D170/D171, Stable, Firebase Rules, Inventory Android/Agent không bị thay đổi. Các giới hạn được đo trong CI và thiết bị thực, không coi code và mock tests thay cho nghiệm thu Google/Drive.

## D172-E029 — UI compact cho PDA và menu thao tác phụ

- Quy cách Android riêng (không sửa Android Báo hàng): khung lề 12dp, header một hàng 18sp + tên tài khoản 12sp, menu ⋮ 40dp; khoảng cách khối 5–10dp, input 44dp, CTA Lưu 46dp, ba tab dưới 42dp; cỡ chữ nội dung 13–16sp, tối ưu tương phản.
- Nghiệp vụ: QR + nút Tách QR nhỏ chung hàng; Mã cửa hàng / DO là cặp input label-above; Số kiện / Vị trí là cặp input label-above; giữ Enter/QR parser, ID và tổng số kiện, lưu và focus. Nút phụ không vượt kích thước CTA.
- Vị trí: ô mới + Thêm chung hàng; thanh Chọn tất cả / Xóa đã chọn (n) cao 38dp; mỗi dòng mã vị trí/checkbox gọn, giữ nhấn giữ đổi tên và xác nhận xóa.
- Lịch sử: mỗi mục nền theo Core sync state, ngày giờ + trạng thái nhỏ dòng đầu, thông tin MCH/DO/tổng kiện/vị trí dòng sau có thể quấn chữ, không ellipsis mất mã; giữ chọn nhiều, xóa và nhấn giữ sửa.
- Không đặt Đồng bộ dưới các tab; đưa Đồng bộ ngay vào ⋮, giữ xác nhận và cooldown Core 60s. Gửi log thủ công cũng ở ⋮ nhưng chỉ gọi uploader sau xác nhận; lịch tự động 21:15 và retry/Drive ACK nguyên vẹn.
- Kiểm thử: Android Gradle build + source contract cho ba tab, đủ trường, scanner/lưu/đổi tên/xóa/màu sync, popup; phải nghiệm thu hiển thị thực trên PDA. Không tăng số request hoặc mở rộng provider.


## D172-E034 — Ghi Google Sheet không lệch cột, không mang định dạng header
- Với bản ghi, ánh xạ vật lý bất biến A:J: ID, Ngày, Thời gian, Scan QR, Mã cửa hàng, DO, Số kiện, Vị trí, Người thao tác, Cập nhật lúc. Không suy ra tọa độ từ vùng dữ liệu người dùng đang hiển thị, cột ẩn, filter, hay heuristic của `spreadsheets.values.append`.
- Writer sử dụng Google Sheets GridData `appendCells` hoặc `updateCells` trên `sheetId` chính xác, mọi dòng nội dung mang nền trắng và chữ thường; dòng header (row1) không thay đổi. Đọc đủ các cột của từng tab để lập chỉ mục bản ghi vật lý. Không đọc Sheet làm nguồn nghiệp vụ hoặc tự động thêm dòng sai. Retry/ACK theo InventoryCore như cũ.
- Khi phát hiện di sản dịch cột A trống, B có UUID của Core, C là ngày hợp lệ, index nhận diện row theo ID ở B. Đối soát từ Core cập nhật A:J ngay tại hàng cũ, xóa dữ liệu dư K, không nhân đôi ID và không thay đổi dữ liệu gốc tại Core.
- Google Sheet thuộc tập tài nguyên đã đăng ký; phục hồi thực địa E034 có tab sao lưu ẩn cùng Sheet, chỉ sửa dòng sai được Owner chỉ ra và bỏ định dạng cũ của hàng dữ liệu. Đóng D172 chỉ khi kiểm tra ghi mới lúc A ẩn, định dạng không nhân bản, thời gian VN và các trạng thái Google ACK đúng trên thiết bị thật.


### D172-E035 — Quy tắc triển khai E034
Đây là sửa lỗi **server/Cloud-only**, APK v7 không cần build/ký/cập nhật. Chỉ `service/src/obpp1291-sheets.ts` thay đổi nghiệp vụ; thêm kiểm thử Writer và gate bảo vệ. Chỉ triển khai Worker hiện hữu trên nhánh `main` sau CI/authority/continuity và phê duyệt Owner; không được làm mới tag `obpp1291-v7` hoặc `obpp1291-latest.json`. Kiểm tra `/health.source_commit` khớp merge commit, `/api/obpp1291/status` READY/SCOPED_CONNECTED và Google Sheet giữ A:J, không có nền xanh/chữ đậm ở các bản ghi. Không tạo bản ghi nghiệp vụ giả trên Sheet production để thử nghiệm; dùng CI mock fixture và dữ liệu thực mới khi Owner thao tác. FIELD/OWNER PASS vẫn FALSE đến khi Owner nghiệm thu.
