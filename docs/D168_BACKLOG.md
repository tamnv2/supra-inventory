# D168 — Tiếp nhận yêu cầu, log và phân tích sau D167

**Mở ngày:** 2026-10-13 (Asia/Ho_Chi_Minh).  
**Owner chốt:** D167 **PASS phạm vi Beta đã triển khai, chưa ghi nhận lỗi tại thời điểm chốt**; yêu cầu mở D168 để ghi nhận thêm việc/log, phân tích, đề xuất và chỉ xử lý code/triển khai **theo lệnh Owner**.  
**Accepted base:** D167 (limited-as-deployed Owner PASS), theo `ops/project-state.json` và hồ sơ PR #581.  
**Phạm vi tài nguyên:** chỉ những gì đã đăng ký trong `ops/project-scope.json`; Stable luôn OWNER-GATED.

## Chính sách vận hành D168

- Bắt đầu mọi phiên D168 bằng bootstrap `ops/authority-manifest.json`, toàn bộ `bootstrap_order`, journal `ops/change-continuity/D168.json`, hiện trạng GitHub/CI/source rồi mới phân tích.
- Mỗi yêu cầu, đề xuất, quyết định, phát hiện kỹ thuật, log và công việc dở dang đều ghi vào journal D168 theo `docs/CHANGE_CONTINUITY_PROTOCOL.md`; quyết định Owner đã chốt phải đồng bộ Owner Decisions, spec và project state tương ứng. Không dựa riêng vào trí nhớ chat.
- **Chỉ nhận log/phân tích/đề xuất là mặc định.** Không tự đổi code, dịch vụ, Beta/Web/PDA/Agent, workflow hay Stable khi chưa được Owner phê duyệt sau đánh giá tác động.
- `chạy code` = hoàn thiện toàn bộ code + kiểm tra/CI tới CODE READY, dừng trước triển khai. `duyệt triển khai` = phát hành mã đã PASS trong phạm vi đã chốt. `chạy code và triển khai`/`triển khai luôn` = làm cả code và phát hành Beta đã được phép, sau kiểm tra bắt buộc, không hỏi duyệt giữa chặng. Stable luôn cần cho phép riêng.
- Không bổ sung raw log chứa thông tin nhân sự, SKU riêng tư, mật khẩu, token, session, credentials, private URL vào repo public. Ghi kết luận và tham chiếu chứng cứ khử nhạy cảm. Không tự xóa, hợp nhất hoặc phát hành lại dữ liệu nguồn.
- Nghiệm thu kỹ thuật/CI, phát hành Beta, quan sát thiết bị, chỉ số billing và Owner PASS là các trạng thái riêng. Không mở D169 trước khi D168 Owner PASS.

## Các dòng công việc tiếp nhận (chưa phải lệnh code)

| Nhóm | Điểm xuất phát | Cách xử lý D168 |
| --- | --- | --- |
| Nhật ký mới | Owner cung cấp log, lỗi, giờ xảy ra hoặc hành vi mới | Đối chiếu nguồn, phân loại nguyên nhân, rủi ro, đề xuất; chờ lệnh sửa cụ thể |
| Usage/chi phí | D167 đã triển khai công cụ đo, chưa chứng minh tối ưu tổng billed Firestore/Cloudflare | So sánh ca tương đương và meter theo đơn vị thật, cân nhắc không sửa / sửa hot path / phân bổ an toàn; không tự giảm chất lượng realtime/ACK/HA |
| Agent/HA/WMS | Agent v130 phát hành Beta, chưa chứng minh đầy đủ cài đặt máy và mọi tình huống | Rà log mới, kiểm tra source/CI và đề xuất riêng; không thay đổi PRIMARY, WMS Confirm hay tự cập nhật máy |
| Web/SKU/nhân sự | Web 3.1.1 và daily FULL/DELTA đã phát hành; D167 Owner chốt hiện chưa thấy lỗi | Nếu xuất hiện lỗi mới, xử lý trong D168 với biên nhận chính xác, kiểm tra ngày Việt Nam và hợp đồng API |
| Android/PDA, log Drive | Signed vc106 phát hành, chưa chứng minh mọi PDA cài đặt và tất cả Drive bundle | Nhận bằng chứng log để phân tích, không ép OTA hay xóa log |
| Bảo vệ CI/CD | Owner đã chốt lệnh CODE READY/DEPLOY; guard hiện có nhưng chưa chứng minh toàn diện các cách kích hoạt | Kiểm tra khi được yêu cầu, không cho phép phát hành ngoài phạm vi; giữ code-only và Stable gate |
| Launcher | Ứng dụng Launcher thuộc project/repo khác | Chỉ ghi tham chiếu và chuyển về đúng project khi Owner yêu cầu, không mutate từ Inventory |

## Trạng thái đầu kỳ

- **D168:** OPEN — ghi nhận và phân tích theo lệnh; chưa có yêu cầu code/triển khai mới.
- **Đã phát hành trước D168:** Web Beta 3.1.1, Agent Beta v130, Android Beta vc106, Worker/Gateway thuộc D167; không release lại.
- **Nguồn sự thật:** `ops/project-state.json`, `docs/OWNER_DECISIONS.md`, `ops/change-continuity/D168.json` và source/CI; không sao chép nguyên văn thông tin nhạy cảm vào tài liệu.

## Đề xuất mới ngày 2026-10-13 — CHỜ PHÂN TÍCH, CHƯA DUYỆT CODE/DEPLOY

### D168-REQ-001 — Nhấn giữ SKU trên Android để sao chép (Picker & Reporter)
- **Yêu cầu Owner:** Nhấn giữ phần thông tin SKU ở ứng dụng Android để sao chép mã SKU, thuận tiện dán sang ứng dụng khác. Phạm vi bắt buộc có trạng thái **đang báo, đã có hàng, cho phép Skip, đã thu hồi, quá hạn**, cho cả Picker và Reporter; lưu ý các biến thể danh sách, popup, chi tiết và kết quả lịch sử đang hiển thị khi phân tích.
- **Trạng thái:** `PENDING_ANALYSIS__NOT_APPROVED_FOR_CODE_OR_RELEASE`. Chưa code, chưa cập nhật APK.
- **Nhận định ban đầu về Usage:** Nếu xử lý `long-press` trực tiếp trên text SKU hiện đã có trong view model và gọi Android clipboard API tại thiết bị, thao tác **không tạo read/write/request mới** cho Worker, D1, Firebase, WMS hay Agent. Không thêm polling, prefetch, đọc lịch sử hay request xác nhận.
- **Việc cần kiểm tra trước khi trình Owner:** Rà nguồn UI và mọi trạng thái Picker/Reporter (kể cả mục quá hạn/thu hồi), độ ưu tiên gesture với scroll/select, SKU hiển thị có hậu tố/tiền tố phải chép **mã SKU gốc**, phản hồi "Đã sao chép SKU" thuần local, giới hạn phân quyền: chỉ cho copy SKU đã hiển thị hợp lệ và không tạo đường truy cập mới. Android phải build/phát hành APK mới **nếu sau này được duyệt triển khai**, nhưng yêu cầu hiện tại chỉ là ghi nhận.
- **Khuyến nghị sơ bộ:** Thiết kế hành vi local-only dùng ClipboardManager/ClipData; không thay đổi schema/Service hay các đường dữ liệu. Chỉ chốt giải pháp cuối sau source/UI review.

### D168-REQ-002 — Hiển thị họ tên nhân sự Inventory phản hồi/xác nhận SKU
- **Yêu cầu Owner:** Kèm tên người Inventory đã thao tác xác nhận/phản hồi SKU và thời điểm. Mẫu hiển thị: **"Invent phản hồi lúc 15:50 bởi [Họ tên Invent]"**. Không được thay thế tên người xác nhận bằng Picker báo thiếu, người cập nhật catalog, Agent đồng bộ SKU hoặc người sửa trạng thái khác không cùng sự kiện.
- **Trạng thái:** `PENDING_ANALYSIS__NOT_APPROVED_FOR_CODE_OR_RELEASE`. Chưa code và chưa thay đổi Service, payload hay database.
- **Việc cần kiểm tra trước khi trình Owner:** Nguồn dữ liệu hiện đã có actor/userId/displayName và timestamp ở event kết quả nào; các thao tác "Đã có hàng", "Cho phép Skip", "Sửa kết quả", "Thu hồi" có cùng loại actor hay phải phân biệt; trường hợp chưa có xác nhận, nhiều lần sửa kết quả, đổi tên user, thiếu tên, quyền xem và lịch sử; lựa chọn mốc thời gian hiển thị theo Asia/Ho_Chi_Minh; kiểm tra khả năng dùng **actor và thời gian đã nằm trong response/realtime payload hiện có**, tránh gọi thêm API.
- **Usage:** Nếu tên nhân sự đã có ở view model/payload thì render local **0 request mới**. Nếu mới chỉ có user ID thì ưu tiên join/batch từ map tên đã có trong dữ liệu phiên; nếu chưa có tên trong dữ liệu thì cần phân tích bổ sung payload/cache phù hợp, chi phí một lần và nguy cơ lộ PII; **chưa khẳng định 0 Usage** khi thiếu bằng chứng code.
- **Bảo mật & tính đúng:** Chỉ hiển thị họ tên cho role được phép trên nghiệp vụ hiện tại; không suy diễn người thao tác, không ghi tên thực của nhân viên trong repo public để minh họa; giữ audit provenance chính xác.
- **Khuyến nghị sơ bộ:** Ưu tiên reuse dữ liệu kết quả và người xử lý đã có, không thêm polling/read theo từng SKU.

### Biên giới cấp quyền
Hai yêu cầu trên chỉ được **ghi nhận** theo chỉ đạo Owner, **không** đồng nghĩa phê duyệt thiết kế cuối, source change, schema, OTA, Beta deployment hoặc Stable deployment. Đến khi Owner yêu cầu phân tích, cần so sánh phương án với code thật, nguồn dữ liệu, ảnh hưởng Android UI/API/Service/Agent/usage, sau đó trình phương án; chỉ triển khai khi nhận được lệnh của Owner theo protocol.


## D168 — Bốn yêu cầu Agent mới (Owner 2026-10-13; CHỜ PHÂN TÍCH)

**Lệnh Owner:** Ghi nhận vào backlog để phân tích sau; chưa chốt giải pháp kỹ thuật, chưa cho chạy code, chưa cho triển khai Agent/Web/Android/Worker/Firebase hay thay đổi dữ liệu. Các mục bên dưới giữ nguyên phạm vi ý định ban đầu; mọi nhận xét về Usage chỉ là yêu cầu tối ưu, chưa chứng minh bằng source/log.

### D168-REQ-003 — Danh sách Picker đang hoạt động: hiển thị phiên bản app Báo hàng

- **Mong muốn:** Bổ sung cột hiển thị **phiên bản ứng dụng Báo hàng Android mà từng Picker/PDA đang sử dụng**, đặt **ngay sau cột “Nguồn xác nhận” và trước các cột nút thao tác (buttons)** trong danh sách Picker đang hoạt động trên Windows Agent.
- **Chờ phân tích:** Phiên bản đã có sẵn trong thông tin phiên/PDA, heartbeat, presence, login/session hoặc payload đang nhận của Agent hay chưa; phân biệt chưa ghi nhận và quá cũ, số phiên/thiết bị, logout/relogin, trường hợp người dùng Web không có APK; xác định nguồn đúng, độ mới, field/layout và quyền xem mà không làm tăng lượt đọc provider không cần thiết.
- **Tiêu chí định hướng:** Không báo nhầm phiên bản Agent là phiên bản APK; không suy ra phiên bản khi thiếu dữ liệu; không thêm poll per Picker. Chỉ cập nhật code sau phê duyệt.
- **Trạng thái:** `PENDING_SOURCE_DATA_UI_ANALYSIS__NO_CODE_OR_DEPLOY`.

### D168-REQ-004 — Làm mới danh sách Picker đang hoạt động đúng thực tế, ít Usage

- **Hiện tượng Owner phản ánh:** Sau khi **Kick hết user**, danh sách Agent đôi khi vẫn còn Picker; có trường hợp Picker đã **logout** nhưng còn hiển thị hoặc danh sách phản ánh sai tình trạng thực tế.
- **Mong muốn:** Cơ chế làm mới danh sách hoạt động **trực quan, đúng dữ liệu và gần thời gian thực nhất có thể**, ưu tiên tiết kiệm tối đa Usage; hiển thị chính xác khi login/logout/kick, sau reconnect/failover, khi Agent mở lại và khi nhận snapshot cũ.
- **Chờ phân tích:** Nguồn authority của online/presence, login/logout/kick/revoke/sync session; kiểm tra đường push/events có sẵn, replay/ordering/dedupe, TTL/stale marking, page cache, hành vi rớt kết nối và cách reconcile ít request; đối chiếu log thời điểm logout/kick thực tế. Không được coi là đã tìm ra bug chỉ dựa vào báo cáo hiện tượng.
- **Định hướng:** Ưu tiên event-driven từ thông điệp đang tồn tại, local invalidate khi có sự kiện, snapshot đối chiếu có giới hạn chỉ khi thực sự cần; không tự thiết lập polling dày hoặc đổi logic kick/online authority trước khi có bằng chứng. Theo dõi lượng read/write, CPU, độ trễ, trường hợp mạng chập chờn và quota.
- **Trạng thái:** `PENDING_LOG_ROOT_CAUSE_AND_USAGE_ANALYSIS__NO_CODE_OR_DEPLOY`.

### D168-REQ-005 — Tab “Cập nhật SKU” Agent: thay list/search, đồng bộ thông tin liên Agent

- **Mong muốn về UI:** **Bỏ phần hiển thị danh sách SKU và chức năng tìm kiếm SKU** trong tab “Cập nhật SKU” vì không phục vụ nhu cầu hiện tại; thay bằng **thông tin có ích cho vận hành**. Phần thông tin thay thế cụ thể **chưa chốt**, cần đề xuất Owner duyệt trước.
- **Gợi ý chỉ để phân tích, không chốt triển khai:** Lần FULL và DELTA gần nhất và kết quả; người bấm cập nhật, Agent thực hiện, số SKU thêm/sửa/ẩn; độ mới danh sách trong ngày, tình trạng khu vực, các lần tự động tiếp theo, lỗi xác thực/đồng bộ có phân loại, nguồn xác thực của biên nhận cập nhật; không trộn nhật ký riêng Agent với trạng thái được Service xác nhận.
- **Mong muốn về đồng bộ:** **Tự đồng bộ thông tin trạng thái tab SKU giữa các Agent**, tận dụng tối đa kênh truyền thông/heartbeat/role/HA/đường dữ liệu đã hoạt động để tiết kiệm Usage. Không khẳng định “0 Usage” khi chưa đối chiếu đường dữ liệu, payload hiện có và server/Agent băng thông.
- **Chờ phân tích:** Source Agent v130 và logic SKU v126–129; trạng thái global vs local của từng Agent, owner của lần FULL/DELTA, timestamp/actor/provenance, khả năng replay/snapshot cho Agent vừa khởi động hoặc mất mạng, permissions/HA và giới hạn freshness/size; đánh giá lợi ích thay thế list/search trước khi xin duyệt UI.
- **Ràng buộc:** Không thay đổi luồng tải SKU từ WMS, giờ cập nhật, confirm picklist, danh sách SKU chủ hoặc cập nhật Service/Android chỉ vì mục ghi nhận. Chỉ đề xuất giao thức/surface dùng chung khi đã có bằng chứng thực tế.
- **Trạng thái:** `PENDING_UI_REDESIGN_AND_EXISTING_TRANSPORT_ANALYSIS__NO_CODE_OR_DEPLOY`.

### D168-REQ-006 — Agent Windows: bật/tắt tự khởi động cùng máy

- **Mong muốn:** Thêm tùy chọn **Bật/Tắt tự khởi động Agent khi máy tính khởi động/đăng nhập Windows**, hiển thị trong **Cài đặt Agent** và lưu lựa chọn theo máy/đúng phạm vi Windows account.
- **Chờ phân tích:** Cơ chế startup sẵn có (nếu có); Startup folder/HKCU Run/Task Scheduler và quyền hiện hành; user-scoped vs machine-wide, UAC, startup khi chưa login, đường dẫn EXE sau auto-update, single-instance và tránh khởi động trùng Agent Primary/Standby; kiểm soát quyền/tắt mở, logging an toàn và khả năng gỡ cấu hình.
- **Ràng buộc:** Ưu tiên cài đặt local trên Windows (không thêm Cloudflare/Firebase/Gateway usage); không tự động bật cho tất cả máy hoặc thay đổi startup khi chưa được Owner duyệt rõ. Giữ nguyên policy HA, failover và hoạt động Agent đang chạy.
- **Trạng thái:** `PENDING_WINDOWS_STARTUP_DESIGN_ANALYSIS__NO_CODE_OR_DEPLOY`.

**Tổng D168 trong backlog hiện có:** D168-REQ-001, 002 (Android/Invent) và D168-REQ-003, 004, 005, 006 (Agent). **Tất cả đang chờ phân tích, chưa PASS code, chưa triển khai**, chỉ ghi nhận repo bằng PR tài liệu.
