
## D168-E018 — Owner đã duyệt trọn gói code và Beta; đang thực hiện (14/10/2026)

**Quyền:** Owner xác nhận “Duyệt. Tiến hành xử lí, chạy code và triển khai toàn bộ”. Cho phép code và triển khai Beta **chỉ sau tất cả CI/continuity/security/field PASS**; Stable OWNER-GATED. Các trạng thái RECORD_ONLY/PENDING_APPROVAL của D168 cũ được thay thế bởi phê duyệt mới; **không suy diễn là code DONE hoặc deployed**.

**Nghiệp vụ điều chỉnh:** FULL 05:00 bắt buộc dù chỉ có PRIMARY; WMS chạy trên mạng thường theo Owner; direct authenticated Worker/InventoryCore thay Google Apps Script cho SKU; job grant riêng tiếp tục sau PRIMARY handoff; Firebase giữ login/Picklist/ACK/HA/presence.

**Các thay đổi đã ghi lên nhánh PR #591:** một phần service Worker/Core SKU reserve/claim/stage/publish job grant; Agent direct Worker retry suppression/SKU UI/autostart/log; Android sao chép SKU và thời gian phản hồi; FCM app_version → presence → Agent picker grid; retire Agent Usage tab. Không có kết quả field E2E hay Beta deployment mới từ các commit này.

**Các điểm CHƯA HOÀN TẤT, tuyệt đối không phát hành Beta khi còn tồn:**
- Network controller: xác minh WMS/Worker/Firestore trên mạng thực, quản lý profile Wi-Fi đã được cho phép, 60s/15m idle-only safe switch, xử lý solo PRIMARY, dữ liệu và nguồn mã an toàn; resource/profile chưa xác định fail closed.
- Durable SKU job: kiểm thử 15 phút TTL/retry, mất phản hồi publish, concurrent reserve, WMS xuất thiếu, FULL ngày mới, no-op DELTA, đổi PRIMARY và mạng đang xác nhận; bổ sung lease recovery nếu cần.
- REQ-004: session-generation-kick/logout/tombstone realtime reconciliation và nhãn kết nối thực tế.
- REQ-007: nhắn/gọi chung nhiều/toàn bộ Picker: fanout bounded, per-session validation, group status/idempotency và FCM/Firestore guard.
- Giao diện Web, Agent cross-fleet shared SKU job status and provider measurement, đầy đủ release version bump đồng bộ Agent/Android/Web.
- Chạy toàn bộ CI và nghiệm thu field thực, authority+continuity PASS, PR merge và phát hành Beta. Không đưa code lên Stable.


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


## Bốn yêu cầu Agent ngày 13/10/2026 — CHỜ PHÂN TÍCH

**D168-REQ-003 — Phiên bản App Báo hàng trong danh sách Picker online**
- Owner yêu cầu hiển thị phiên bản Android App mà từng Picker đang dùng; đặt cột **ngay sau "Nguồn xác nhận" và trước nhóm nút thao tác**.
- Chờ phân tích các trường dữ liệu đang có trong phiên hoạt động, nguồn version, thời điểm cập nhật khi app nâng phiên bản và cách hiển thị khi chưa biết. Ưu tiên tận dụng thông điệp hiện có; không phát sinh truy vấn riêng theo Picker.
- Trạng thái: **GHI NHẬN, CHƯA PHÂN TÍCH/CODE/DEPLOY**.

**D168-REQ-004 — Làm mới chính xác danh sách Picker online với Usage tối thiểu**
- Owner phản ánh danh sách Agent đôi khi vẫn còn Picker sau khi kick hàng loạt hoặc sau logout. Cần rà cơ chế hiện diện, cập nhật event và refresh để hiển thị gần thời gian thực nhất, tránh dữ liệu cũ.
- Chờ phân tích logout, kick, rớt mạng, reconnect, bộ nhớ đệm, snapshot khởi tạo, event sequence, timeout hợp lý, race condition và log thời gian sự kiện/Agent nhận. Đối chiếu nhiều máy Agent.
- Ưu tiên event/delta sẵn có và cập nhật cục bộ khi sự kiện xác nhận, chỉ đối soát bổ sung khi cần; tránh tăng poll hàng loạt/heartbeat. Không giả định ngay nguyên nhân hoặc cam kết luôn tức thời khi thiết bị mất mạng.
- Trạng thái: **GHI NHẬN, CHƯA PHÂN TÍCH/CODE/DEPLOY**.

**D168-REQ-005 — Thiết kế lại Tab SKU và đồng bộ trạng thái giữa các Agent**
- Bỏ khu vực danh sách SKU và tìm kiếm SKU trong Tab "Cập nhật SKU" của Agent. Thay bằng thông tin thiết thực hơn; **phương án giao diện phải trình Owner duyệt sau khi phân tích**.
- Gợi ý ban đầu để đánh giá: lần FULL/DELTA và kết quả, số liệu thay đổi, lịch cập nhật, nguồn máy/người thực hiện, biên nhận đồng bộ của từng Agent, ngày dữ liệu hiện tại, cảnh báo và nguyên nhân lỗi. Không thêm thông tin không có nguồn thực.
- Yêu cầu tự đồng bộ trạng thái Tab SKU giữa các Agent, ưu tiên luồng truyền dữ liệu đang tồn tại, gần như không phát sinh Usage mới. Kiểm tra sự khác biệt giữa trạng thái xử lý và trạng thái đã nhận ở máy khác, thứ tự phiên bản và thời điểm reconnect.
- Không đổi lịch SKU hoặc nghiệp vụ confirm chỉ vì thay giao diện.
- Trạng thái: **GHI NHẬN, CHƯA PHÂN TÍCH/CODE/DEPLOY**.

**D168-REQ-006 — Bật/tắt tự khởi động Agent cùng Windows**
- Trong Cài đặt Agent, bổ sung lựa chọn "Tự khởi động Agent cùng Windows" theo máy.
- Chờ phân tích cơ chế startup phù hợp (sau Windows login hoặc khi bật máy), quyền user, lưu setting, nâng phiên bản, chống mở trùng tiến trình, thông báo lỗi và ảnh hưởng đến hoạt động nền/Usage.
- Không tự chuyển vai trò máy chính hoặc khởi động tác vụ xác nhận khi chỉ mở Agent.
- Trạng thái: **GHI NHẬN, CHƯA PHÂN TÍCH/CODE/DEPLOY**.

**Quyền thực hiện:** Bốn yêu cầu chỉ được ghi vào backlog D168 để chờ phân tích; không được coi là lệnh sửa mã nguồn hoặc triển khai Windows Agent, Android App hay Service. Usage ước lượng và phương án đồng bộ phải kiểm tra từ code/log thực tế trước khi trình duyệt.


## D168-REQ-007 — Liên hệ nhóm Picker đang hoạt động (13/10/2026) — CHỜ PHÂN TÍCH

**Yêu cầu Owner:** Trong Agent, cho phép **chọn nhiều Picker hoặc chọn tất cả Picker đang hoạt động** và thực hiện một trong hai thao tác chung:
1. **Nhắn một nội dung giống nhau** tới tất cả Picker đã chọn, thay vì phải nhắn riêng từng người.
2. **Gọi về bàn chuyên viên** tới tất cả Picker đã chọn cùng lúc bằng chức năng gọi hiện có.

**Trạng thái:** `OWNER_REQUESTED_BACKLOG_ONLY__PENDING_ANALYSIS__NO_CODE_OR_DEPLOY`. Không tự triển khai hay thay đổi APK, Agent, Service, backend.

**Điểm cần phân tích khi Owner yêu cầu:**
- UI danh sách Picker online: chọn nhiều, chọn tất cả Picker **đang hoạt động thực sự**, bỏ chọn, số Picker được chọn, bộ lọc/tìm kiếm có tác động tới chọn tất cả không; hiển thị rõ danh sách/số lượng để xác nhận trước khi gửi.
- **Đúng người nhận:** xác minh hiện diện và phiên hiện tại tại thời điểm phát lệnh; không gửi nhầm Picker logout, bị kick, offline, phiên cũ hoặc trùng tài khoản/thiết bị. Kết nối với D168-REQ-004 (độ chính xác danh sách Picker).
- **Nhắn chung:** một nội dung do chuyên viên nhập, cùng nội dung cho nhóm; tận dụng đường gửi thông báo/tin nhắn hiện có. Quyền Agent/Invent, giới hạn nội dung, chống gửi trùng, phản hồi thành công/thất bại theo từng Picker và ghi log tối thiểu có kiểm soát.
- **Gọi về bàn:** tái sử dụng giao diện cuộc gọi về bàn trên PDA và đường điều khiển đã có; làm rõ khi gọi hàng loạt thì từng Picker nhận/hiển thị/kết thúc thế nào, không cho cuộc gọi mới làm gián đoạn trái phép hoạt động xác nhận Picklist/ACK hoặc các cảnh báo ưu tiên.
- **Tính đúng và vận hành:** so sánh kết quả từng người (đã gửi / đã nhận / chưa nhận / lỗi / không còn online), hạn chế thao tác phát lệnh hai lần, xem xét batch và giới hạn số thiết bị ở thời điểm burst; không tuyên bố tất cả đã nhận chỉ dựa vào kết quả server gửi.
- **Usage:** 1 hành động gửi cho N Picker có thể cần tối thiểu N lần fanout/nhận ở thiết bị; không thể khẳng định **0 Usage** cho gửi thông điệp. Phương án ưu tiên dùng lại luồng thông điệp, relay/FCM hoặc event hiện có, không mở polling/listener/timer mới, không tăng số request kiểm tra trạng thái per-user; đo chi phí Cloudflare/Firebase và khả năng burst trước khi thiết kế cuối.
- **An toàn/RBAC:** chỉ quyền được phép liên hệ Picker; tránh lộ thông tin của Picker khác, tránh thông điệp sai người, lặp lại hàng loạt và mất khả năng hủy/kết thúc gọi. Ghi log không chứa bí mật hay nội dung nhạy cảm vào public repo.
- **Cần trình Owner sau phân tích:** wireframe bố trí chọn nhiều/chọn tất cả, luồng gửi thông báo/gọi và kết quả riêng từng Picker, phương án tối ưu Usage, ảnh hưởng Agent/Android/Service và test khi một số Picker offline giữa lúc gửi.

**Giới hạn chỉ đạo hiện tại:** ghi vào backlog/continuity và chờ lệnh **phân tích**. Không được coi là lệnh `chạy code`, `triển khai` hoặc nâng phiên bản.


## D168-REQ-008 — Hai Agent gửi nhật ký Drive không ổn định (13/10/2026) — P0, CHỜ DUYỆT SỬA

**Yêu cầu Owner:** Ghi vào backlog D168 lỗi hai Agent không thường xuyên chuyển được nhật ký lên Drive; phân tích từ hai file local Owner cung cấp, giữ nguyên Agent Admin hiện gửi bình thường làm mốc đối chiếu. Không coi kiểm tra log là lệnh triển khai.

**Bằng chứng từ file cục bộ:** Agent A 7.663 dòng, 22 lần \`AGENT LOG upload=DEFER\` (14 timeout, 5 keep-alive closed, 3 receive failures) và 1 \`upload=PASS\`; Agent B 1.983 dòng, 20 lần \`upload=DEFER\` (16 timeout, 4 keep-alive closed) và 1 \`upload=PASS\`. Cả hai có lần được Drive xác nhận nên chưa chứng minh mất quyền Drive hoàn toàn. Không commit raw log, nhân sự, token hoặc định danh máy thực vào repo public.

**Đối chiếu source:** \`relay-agent/AgentLogUploadBridge.cs\` đặt HTTP \`Timeout/ReadWriteTimeout=10000ms\`, retry 1/2/5/15/30 phút, pending-file giữ lại đến \`drive_synced=true\`. \`ops/apps-script/agent-log-gateway/Code.gs\` có \`LockService.waitLock(15000)\` trước kiểm tra ngày lưu, Worker và Drive; cấu hình timeout trước thời gian backend có thể chờ là không tương thích. Lệnh thủ công \`manual=SEALED upload=TRY\` vẫn chịu cooldown; không là biên nhận Drive. Rủi ro upload trùng/chồng cần kiểm chứng lock single-flight. Sự khác biệt mạng/proxy và Gateway runtime chưa đo trực tiếp.

**Đề xuất để Owner duyệt sau:** Ưu tiên Agent-only: deadline đủ thời gian cho Gateway có kiểm soát, kết nối/retry hợp lý, khóa một uploader duy nhất, xử lý thủ công hiển thị ACK thật, trạng thái số bundle pending/lần Drive xác nhận, không xóa local khi thiếu ACK. Chỉ sửa Apps Script khi trace execution xác nhận nghẽn phía backend. Rà soát ngưỡng size/idempotency/day-boundary và thử nghiệm 3 Agent. Không ảnh hưởng WMS Confirm/HA, service/UI/Android; không thêm polling hoặc per-event provider writes.

**Trạng thái:** \`EVIDENCE_CONFIRMED_TWO_AGENTS__ROOT_CAUSE_PARTIAL__PENDING_OWNER_CODE_APPROVAL__NO_DEPLOY\`.

## D168-REQ-009 — SKU DELTA cuối ca 19:00–19:15 không có biên nhận DONE, lỗi lặp gây tăng Usage (13/10/2026) — P0, CHỜ DUYỆT SỬA

**Yêu cầu Owner:** Kiểm tra lý do không có cập nhật SKU tự động theo lịch cuối ca khoảng 19:00 ngày 13/10/2026; rà chuỗi FULL đầu ca → DELTA giữa ca → DELTA cuối ca, máy PRIMARY/HA, quota Gateway, lịch VN và biên nhận Service.

**Bằng chứng file local:** Agent A (PRIMARY tại mốc 19:00) có **948** \`D167_SKU sync=DEFER\` từ 16:49:19–19:52:01, trong đó 937 \`InvalidOperationException / UNKNOWN\`, 8 \`IOException\` đã phân loại Gateway và 3 \`WebException / UNKNOWN\`. Các lỗi cách nhau thường ~11 giây; mốc 18:59:55, 19:00:06, 19:00:31 và liên tục hết cửa sổ 19:15. Agent B có **161** lỗi tương tự từ 15:20:39–15:51:12; không có SKU DONE trong file. Hai file không có \`D167_SKU slot=DELTA_19 stage=EXPORT_BEGIN\`, \`SERVICE_UPLOAD_BEGIN\` hoặc \`stage=DONE\`. Không dùng thiếu log để khẳng định Service chắc chắn chưa nhận job: cần read-only biên nhận chính thống để xác minh.

**Lịch chính xác từ source:** \`service/src/d167-sku-sync-logic.ts\` và \`relay-agent/D167SkuSchedule.cs\` chọn một thời điểm ngẫu nhiên máy chủ, persist, trong 19:00 đến trước 19:15 giờ VN; không nhất thiết chính xác 19:00. Lượt DELTA phải có FULL hợp lệ trong ngày; \`service/src/d167-sku-sync-core.ts\` là authority trạng thái/receipt.

**Cơ chế lỗi đã chứng minh bằng mã nguồn:** \`D167SkuCoordinator.Queue()\` khi \`EvaluateOnce()\` lỗi gọi \`Arm(15 phút)\`, nhưng \`Program.cs\` chạy \`_afterHoursTimer\` mỗi giây → \`CheckAfterHoursSchedule\` → \`QueueD128BrowserStateRefresh\` → \`RefreshSupraBrowserStatus\`; nếu browser READY, lại gọi \`OnPrimaryOrWmsReady()\` → \`Queue()\` không tôn trọng retry deadline đã đặt. Điều này phù hợp ~11 giây/lần trong log và gây retry-storm, thay vì tối đa 1 lần/15 phút. Trước bước xuất WMS đã có lỗi \`service.Schedule(day)\`; chưa đủ chứng cứ xác định backend receipt hoặc nguồn WMS lỗi.

**Nghi vấn hạn mức phụ thuộc:** Agent A có 27 dòng \`D160 USAGE refresh=DEFER\` với lỗi được làm sạch chứa \`urlfetch\` và câu tiếng Việt "dịch vụ ... quá nhiều lần trong một ngày" (bắt đầu thấy 14:00). Cùng Google Apps Script Gateway dùng \`UrlFetchApp.fetch\` để verify token và proxy Worker; khi quota hỏng, cả Usage/SKU/log có thể bị ảnh hưởng. Cần đọc Apps Script Executions/quota hoặc phản hồi mã lỗi an toàn trước khi khẳng định tất cả SKU failure do quota. \`D167SkuCoordinator.SafeErrorCode\` rơi về \`UNKNOWN\` với message ngoài định dạng mã allowlist, làm che nguyên nhân.

**Đề xuất để Owner duyệt sau:** (1) chặn trigger \`OnPrimaryOrWmsReady\` lặp khi readiness không đổi hoặc giữ deadline retry xuyên mọi nguồn Queue, để đúng lịch one-shot không polling; (2) phân biệt lỗi schedule/auth/Gateway/quota, log pha và mã lỗi allowlist không tiết lộ secret; (3) thêm retry bounded có cảnh báo SLA 19:00–19:15 và kiểm soát failover, tránh tăng provider traffic; (4) xác minh FULL trong ngày, actual Service \`scheduled_at_ms\`, \`state\`, receipt \`DELTA_19\` và last SKU version bằng **đường read-only hiện có/on-demand**, không thêm timer; (5) test 3 Agent, quota-exhausted, standby takeover, lỗi mạng, 19:00/19:15, 00:00 VN, an toàn Confirm/ACK và chi phí trước/sau. Bảo đảm không nhầm việc cập nhật catalog thủ công với DONE của lượt tự động.

**Rủi ro:** Sai lịch khiến picker báo SKU cũ, ảnh hưởng kiểm soát đầu ca/ngày; retry-storm tăng Apps Script calls/CPU và nguy cơ hạn mức quota, có thể ảnh hưởng cả đường upload log/Usage cùng Gateway. Không đổi app/service/HA tại thời điểm ghi backlog.

**Trạng thái:** \`FIELD_LOG_FAILURE_CONFIRMED__SOURCE_RETRY_STORM_CONFIRMED__SERVER_RECEIPT_PENDING_VERIFICATION__PENDING_OWNER_CODE_APPROVAL__NO_DEPLOY\`.

**Giới hạn chung REQ-008/009:** Chỉ ghi nhận và phân tích vào D168. Chưa có quyền chỉnh mã nguồn/release Agent, Web, Android, Worker, Apps Script hoặc Stable.

## D168-REQ-010 — Xác minh đồng bộ SKU qua Wi-Fi Office so với mạng PDA (13/10/2026) — CHỜ FIELD PASS

**Yêu cầu Owner:** Ghi nhận vấn đề đồng bộ SKU không thành công cuối ca và kiểm tra liệu cập nhật SKU hiện tại chạy được qua mạng Wi-Fi Office nội bộ công ty, hay phải dùng mạng PDA/Internet thông thường. Giữ D168-REQ-008 (log upload) và D168-REQ-009 (SKU 19:00) là P0 riêng, không tạo thay đổi nghiệp vụ hoặc tài nguyên ngoài phạm vi.

**Kết luận kiểm tra source:** Luồng **đã được thiết kế cho cả Office và PDA Internet**, không khóa theo SSID/mạng: Windows PRIMARY đọc file WMS bằng phiên WebView2 phụ và HTTPS GET allowlisted sử dụng system proxy (`relay-agent/D167SkuBrowserExport.cs`, `D167SkuDirectExport.cs`); Agent gửi request `d167_sku_sync` qua existing `script.google.com` HTTPS Apps Script Operations Gateway (`D167SkuServiceClient.cs`) thay vì gọi trực tiếp Worker Beta từ mạng Office; Gateway chuyển tiếp `UrlFetchApp.fetch` đến `inventory-beta` Worker để xử lý CAS/HA và receipt (`ops/apps-script/agent-log-gateway/Code.gs`). Đây là Internet egress tới dịch vụ Google và Worker, **không phải** đồng bộ thuần nội bộ LAN. Office cần cho phép đúng Google Web App endpoint qua corporate filtering/proxy, còn máy PDA cũng sử dụng đúng Gateway theo code.

**Đối chiếu log có khử định danh mạng:** Agent A trên v130 có diagnostic cho thấy Office Wi-Fi đang được dùng tại 17:45 và 18:54; trong cùng những phút này các thử đồng bộ SKU trả `D167_SKU sync=DEFER`, lúc 18:54 một yêu cầu Firebase token-refresh qua Office PASS; 19:00–19:15 tiếp tục lỗi SKU và đến 19:51 máy ghi nhận dùng mạng PDA. Log không gắn network-interface/SSID với *từng* request SKU nên chưa chứng minh request lúc 19:00 thực tế đi bằng Office hay lý do bị từ chối. Agent B có bằng chứng Office ở trước 14:00 nhưng lúc restart 15:18 và các lỗi SKU từ 15:20 máy ghi nhận dùng mạng PDA. Do đó không thể quy lỗi độc quyền cho Office, cũng không thể nhận định SKU **đã** cập nhật thành công trên Office.

**Điểm phân biệt:** Firebase refresh PASS từ mạng Office chỉ chứng minh `securetoken.googleapis.com` tới được, không xác nhận `script.google.com` Web App / quota `UrlFetchApp` / Worker's `DELTA_19` receipt PASS. Log thiếu `D167_SKU slot=DELTA_19 stage=DONE` trên cả hai máy. Lỗi `UNKNOWN` và 27 lần `urlfetch` quota/defer cần được kiểm chứng bằng Apps Script executions và Server receipt, không dựa vào quan sát SSID.

**Thiếu bằng chứng FIELD PASS:** (1) Trên máy được xác nhận đang dùng duy nhất Office Wi-Fi, thực hiện một yêu cầu **đọc trạng thái SKU** qua Gateway có phân pha chẩn đoán an toàn, không cần xuất/publish; (2) nếu được Owner duyệt test sau, chạy một lần cập nhật SKU có kiểm soát và xác minh `DONE` durable receipt trên Service + số lượng/fingerprint đúng; (3) đối chiếu cùng phép thử trên mạng PDA, thời gian/HTTP error class/proxy/Apps Script quotas; (4) kiểm tra các lớp lọc Office, proxy Windows và phân biệt DNS/TLS/403/timeout/quota; không yêu cầu Owner đưa token, mật khẩu, cookie hoặc request WMS.

**Rủi ro thông tin log:** File local đang ghi tên mạng Wi-Fi trong một số diagnostic, trái chính sách `docs/specs/OBSERVABILITY_LOGGING.md` cấm ghi SSID/BSSID. Đề xuất sau khi được phê duyệt chỉ ghi nhóm mạng `OFFICE|PDA|OTHER|UNKNOWN` hoặc trạng thái route/failure class cần thiết; không commit raw SSID hoặc thiết bị/tài khoản vào repo công khai.

**Phương án ưu tiên:** Giữ cùng một tuyến Gateway Office-compatible, không tạo gateway/transport mới hay fallback tới nguồn transaction khác. Sửa nguyên nhân retry-storm của REQ-009 và phân loại lỗi Gateway/quota trước; kiểm tra thực địa trên Office và PDA ở đúng phạm vi khi được phép. Không bật polling mới hoặc đổi HA, WMS Confirm, Web, PDA. Nếu Office lọc thực sự chặn Google Web App endpoint, báo rõ hạn chế và cần lựa chọn tuyến có sẵn được IT cho phép, không tự động né kiểm soát công ty.

**Trạng thái:** `SOURCE_OFFICE_COMPATIBLE_BY_DESIGN__OFFICE_FIREBASE_AUTH_FIELD_PASS__OFFICE_SKU_DONE_FIELD_UNPROVEN__NO_CODE_OR_DEPLOY`. Yêu cầu này chỉ ghi backlog và phân tích; chưa phê duyệt triển khai hay thay đổi kết nối máy.


## D168-REQ-011 — Đẩy SKU qua Office khi không truy cập Cloudflare trực tiếp; giữ nguyên cách xuất Excel SUPRA (13/10/2026)

**Ràng buộc Owner đã xác nhận:** Mạng Office nội bộ **không thể và không được giả định có thể truy cập trực tiếp Cloudflare/hostname inventory**. Nguồn WMS SUPRA đọc qua Office được; tiếp tục sử dụng phương thức GET đọc-only file REPORT BIN INVENTORY XLSX hiện có, đúng phiên Agent/WMS, không click hay ảnh hưởng tab Confirm. Owner yêu cầu phân tích một đường **Office → Inventory Beta Service** khả thi, không phải lệnh code/deploy.

**Hiện trạng source, không nhầm với field PASS:**
- Phần **nguồn**: Agent PRIMARY sử dụng browser phụ trong managed WMS profile để lấy transient authorization context trong RAM, rồi GET allowlisted \`api-supra.winmart.vn\` bằng HTTPS + Windows system proxy, đọc file XLSX Bin Inventory. Bộ parse hiện có xác thực Site HY1/1291, deduplicate SKU, trích SKU/tên/vùng LTA/SHELVING/UNKNOWN/fingerprint. Không tải raw Excel, bí mật phiên WMS hoặc headers lên Service.
- Phần **đích**: \`D167SkuServiceClient.Send\` gọi Google-hosted **existing scoped Apps Script Agent Operations Gateway** \`script.google.com\` cho \`d167_sku_sync\` (schedule/claim/stage/preview/publish/status). Gateway \`validateIdToken_\` bằng Google IdentityToolkit, rồi \`UrlFetchApp.fetch\` tới Worker Beta qua Internet từ phía Google (không từ Office). Worker/InventoryCore thực hiện role validation, PRIMARY HA fencing, claim/stage CAS, reconciliation, atomic DONE receipt.
- Định mức request đã có: snapshot tối đa 5.000 SKU, stage theo chunk 500 (tối đa 10 chunks), từng \`Send\` một lượt qua Apps Script; Google script xử lý ít nhất 2 \`UrlFetchApp\` cho một request là xác thực ID token và proxy Worker. Source có 30s HTTP/read timeout, quota có thể bị chiếm bởi quá nhiều retry. Ảnh hưởng quota **không** bằng 0.
- Apps Script \`ContentService\` trả JSON qua redirect tới \`script.googleusercontent.com\` theo tài liệu chính thức của Google. Agent đã bật \`AllowAutoRedirect=true\`; Office firewall/proxy còn phải cho phép response-redirect host và TLS đúng chính sách. Firestore/Firebase Auth reachable KHÔNG chứng minh Google Web App hay redirect host reachable. Không tự thay proxy policy/bypass filter.
- Log 13/10: SKU retry storm \`D167_SKU sync=DEFER\` và \`urlfetch\` error ở các tính năng khác; chưa có end-of-shift \`DELTA_19 stage=DONE\` trong log. Khả năng Cloudflare bị chặn ở Office **không giải thích riêng** lỗi này vì thiết kế đẩy qua Google, và một Agent cũng lỗi khi trên mạng PDA. Phải đối chiếu Gateway quota, callback response chain và Service durable receipt, không suy ra đã nhập thành công.

**Phương án đề xuất 1 — ƯU TIÊN GIỮ ĐƯỜNG GOOGLE ĐANG CÓ:** Không đổi nguồn Excel WMS hoặc tạo service mới. Sửa nguồn retry storm \`OnPrimaryOrWmsReady\` và giữ cooldown bất kể readiness event; chẩn đoán 3 chặng \`Agent→script.google.com\`, \`ContentService redirect response\`, \`Apps Script→Worker\`, phân loại HTTP/timeout/403/quota bằng mã an toàn. Rà upload bounded/chunk-idempotency và gateway receipt, tận dụng no-op fingerprint nếu file không thay đổi, tránh request thừa và reset định kỳ. Ưu tiên biệt lập tải log/Usage để không làm cạn quota đường SKU, không làm thay đổi session/Confirm và không thêm poll. Chỉ tuyên bố sync PASS sau \`InventoryCore DONE\` và readback đúng \`day_vn/slot/fingerprint\`. Source-only design feasible, Office physical FULL/DELTA proof PENDING.

**Phương án 2 — Chỉ nếu Gateway Google bị chặn hoặc quota cạn kéo dài, CHƯA PHÊ DUYỆT:** Đánh giá lưu snapshot/chunks trong **Firebase Firestore** hiện có qua Office và chuyển tiếp qua **một Google Cloud Function hiện có/được phép** tới Worker Beta, hoặc Worker chủ động lấy snapshot tại Google từ kênh hiện có nếu có cơ chế xác thực/sự kiện đã đăng ký. Không coi Firestore là nguồn SKU chuẩn; staging phải có TTL, per-slot/fingerprint idempotency, 1 PRIMARY generation, size/rules/RBAC, atomic DONE từ InventoryCore, chống replay và thất bại chuyển tiếp. Phải rà resource scope và quota Firestore Writes/Functions/Worker, không giả định Function hiện tại hỗ trợ SKU hoặc đã có credential Worker egress. Phương án này tốn thay đổi Service/Function/Agent, ưu tiên thấp hơn sửa luồng sẵn có; **không triển khai tự động**.

**Phép thử/nghiệm thu trước release:** 1 Office-only PC (không bật Internet/PDA fallback) và 1 máy PDA network; kiểm tra theo endpoint/redirect và proxy bằng yêu cầu nhận diện không đụng WMS/secret, gọi \`schedule/status\` 1 lần có xác thực khi điều kiện cho phép; đối chiếu Apps Script Executions/quota, hạn mức fetch và Service durable receipt; sau khi Owner cho phép mới chạy 1 FULL/DELTA có kiểm soát, đọc lại fingerprint/count/day, test HA handoff/rollback và user cảnh báo khi ngày chưa có FULL. Không ghi SSID/WMS token/proxy credentials vào log hoặc public repo.

**Impact review / release gate:** Agent Beta + existing Beta Apps Script Gateway là phạm vi fix tối thiểu; Worker/InventoryCore có thể cần bổ sung trace nếu hiện thiếu, nhưng không thay đổi SLA/semantics đã chốt. Rủi ro: chặn Google redirect, quota script, bản ghi gửi trùng, giao diện báo DONE giả, mất AUTO confirm do WMS side-tab, sync ngày sai, tăng Usage. Stable và ngoài registered scope không được động chạm. **Chưa chốt phương án cuối, chưa duyệt code hoặc triển khai.**

**Trạng thái:** \`OWNER_CONSTRAINT_OFFICE_NO_DIRECT_CLOUDFLARE__EXISTING_GOOGLE_GATEWAY_ARCHITECTURE_CONFIRMED__OFFICE_END_TO_END_PASS_PENDING__CODE_DEPLOY_NOT_APPROVED\`.

**Nguồn:** \`relay-agent/D167SkuDirectExport.cs\`, \`D167SkuBrowserExport.cs\`, \`D167SkuWorkbook.cs\`, \`D167SkuServiceClient.cs\`, \`service/src/d167-sku-sync-core.ts\`, \`ops/apps-script/agent-log-gateway/Code.gs\`, \`docs/PROJECT_CONTEXT.md#D090\`, Google Apps Script ContentService redirects docs \`https://developers.google.com/apps-script/guides/content\`. Không đưa raw log/bí mật vào repo công khai.
