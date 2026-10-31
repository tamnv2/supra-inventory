# D173-E116 — Điều chỉnh M2 theo bằng chứng: giảm đọc lại, push đúng người nhận, chọn transport theo kết quả

Ngày 31/10/2026, Asia/Ho_Chi_Minh. Tiếp tục D173, Draft [PR810](https://github.com/tamnv2/supra-inventory/pull/810).

**ANALYSIS / REVISED DESIGN PROPOSED. Chưa sửa logic runtime, chưa chạy lại tải cloud, chưa phát hành hoặc chứng nhận tiết kiệm.** Owner yêu cầu đọc bằng chứng E115 và phân tích sâu để điều chỉnh logic, giữ kết quả, chức năng, giao diện, tốc độ, realtime, độ ổn định và các thông số hiện tại; mục tiêu vẫn là không phát sinh usage fee ngoài Cloudflare nền 5 USD. Đây không phải Owner PASS chi tiết thiết kế mới.

## 1. Kết luận kỹ thuật

Giữ M2 nhưng đổi trọng tâm từ **gửi các truy vấn cũ qua WebSocket** sang **mỗi thay đổi được xử lý một lần, sinh kết quả và sự kiện đủ dùng, chỉ đọc bù phần thực sự thiếu**. SQLite hiện tại tiếp tục quyết định giao dịch. Web/APK/Agent dùng chung hợp đồng và reducer theo phiên bản; HTTP và WS dùng chung bộ xử lý, không phát triển hai nghiệp vụ khác nhau.

Điều chỉnh E107: không mặc định chuyển mọi mutation sang WS. Trước hết so sánh phương án đã tối ưu xử lý nhưng vẫn ghi qua HTTP với cùng logic ghi qua WS. Chọn theo kết quả và ngân sách **toàn mô hình**, không kết luận HTTP luôn nhanh hơn từ một burst. Push/subscription/recovery là phần WS cần ưu tiên. HTTP fallback và các đường Office vẫn phải hoạt động.

Phương án thực hiện gồm bốn phần đi cùng nhau:

1. Một snapshot bounded cho màn hình; response giao dịch mang patch đã commit; bỏ tải lại những view đã có đủ dữ liệu.
2. Stream bền theo người nhận/nhóm quyền, tách khỏi global sequence; chỉ replay phần chưa nhận.
3. Bản đọc/tổng hợp cùng SQLite, query theo index và xử lý recipient theo lô; dựng mỗi projection một lần cho mỗi người nhận/view thực sự cần.
4. Đối chứng cùng thao tác nghiệp vụ và tổng chi phí từ đầu đến cuối; meter có trần riêng, không dùng 20:1 để che SQL, thời gian chạy hoặc lỗi reconnect.

## 2. Nguồn và giới hạn chứng cứ

- Accepted-main snapshot: `1ccb12a55a3104729881714953735a7654f9231b`. Working E115 snapshot: `2adf96b4d19c9e59e6956e791aea364b21724f63`. Manifest/bootstrap được đọc/parse tuần tự ở cả hai ref, không thiếu file khai báo; phần lịch sử không cấp quyền phát hành mới.
- Hai gói bằng chứng Owner đã lưu: `D173-E115-27OCT-DAILY-USAGE-BASELINE.zip` và `D173-E115-27OCT-CLOUDFLARE-REAL-AB-TEST.zip`. Gói cloud ban đầu chứa readback sớm; số delayed cuối nằm trong báo cáo E115 và Actions 41176347995. Không lấy readback sớm làm số cuối.
- Báo cáo E106/E107/E108/E114/E115; các source thực liệt kê ở mục 10. Agent162/Web3.3.2/APKvc121 và Worker E103 là release evidence đã đối chiếu ở E106/E107, không phải xác nhận phiên bản cài trên mọi máy hôm nay.
- Provider 27/10: 56.661 raw DO invocations, trong đó 54.055 HTTP; 133.115.948 rows read, 177.739 rows written. Namespace Core dùng chung có thể gồm D172, không quy hết cho Báo hàng.
- Android 27/10: 49 bundle/32 thiết bị; 10.403 attempt quan sát, gồm 5.038 GET delta (48,43%), 1.110 POST ticket (10,67%). Tổng hai nhóm 59,10% **của mẫu client này**, không phải tỷ lệ billable toàn tài khoản. Không có bằng chứng mọi attempt đã tới DO.

### 2.1. Cần hiểu lại bài test E115

| Quan sát | Ý nghĩa đúng / giới hạn |
|---|---|
| 173 lượt đọc mỗi nhánh, tổng 3.070,59 → 1.997,84 ms | Giảm 34,94% thời gian hoàn tất nhóm trong lần chạy đó, không phải mọi request đều nhanh hơn. p50 đọc M2 87,27 ms, HTTP 83,24 ms. |
| p95 đọc 288,07 → 143,75 ms; p99 435,46 → 152,20 ms | Kết quả tốt của mẫu transport; cần lặp có đổi thứ tự và kiểm mạng/PDA để kết luận chất lượng vận hành. |
| Burst 20 writes 228,32 → 249,70 ms | M2 chậm hơn khoảng 9,36% trong lần này. Cả hai vẫn dưới SLA 5 giây nhưng như vậy chưa đáp ứng điều kiện “không giảm tốc độ”. |
| Rows Read 58.059 → 67.596; Written 1.882 → 2.062 | Tăng lần lượt 16,43% và 9,56% trong tổng workload không cân bằng. Không chứng minh M2 tự gây tăng tương ứng ở tải tương đương. |
| M2 thêm 60 WS và 60 reads | Phải tách stress kết nối khỏi phép đo kinh tế chính; không tự trừ 60 reads bằng một hệ số ước lượng. |
| 27/27 checks PASS | PASS theo assertion hiện có; chưa là parity toàn bộ dữ liệu hoặc nghiệp vụ cả ca. |

Đọc trực tiếp `tools/d173_e115_day27/test-real-day27.mjs` và `tools/d173_e112_real_core_lab/worker.ts` cho thấy:

- Test lấy **phân bố số gọi** ngày 27, dùng fixtures nghiệp vụ giả lập của ngày chạy; không phát lại dataset, filter, thời điểm hoặc cursor thật của ngày 27.
- Mọi case delta mẫu dùng `after_seq=0`, adapter đặt `limit=50`; không mô phỏng cursor tiến dần trong ca. Các route được xếp theo nhóm rồi chạy song song từng 8 call; HTTP chạy trước M2.
- Reads chủ yếu assert mã trả về 200 và số lượng; parity mutation chỉ so một số field hình dạng như status/có ticket/có batch/có event. Chưa so toàn bộ giá trị, thứ tự, counters, deadlines, recipients hay UI nhận sự kiện.
- 20 writes dùng một actor `p1` với các SKU khác nhau; 60 socket cũng dùng `p1`. Đây chưa phải 20 PDA/20 phiên hay 60 thiết bị độc lập có xác thực thật.
- Lab gắn identity fixture, không đi đầy đủ Firebase ingress; loại `prepared` trước khi trả result, không chứng minh FCM thật, overlay, DISPLAYED và phiên hết quyền. Core thật không đồng nghĩa toàn bộ pipeline production đã được test.
- Báo cáo đặt `max_websockets=60` nhưng đếm 63 lần mở socket tổng cộng (1 scenario + 60 stress + 2 read); guard chỉ chặn tổng 700 và thời gian, chưa enforce trần WS riêng. Phải sửa guard của bài thử tiếp theo, không tuyên bố 60 là tổng cả run.
- Production đã có server push: `read-model-core.ts::realtimeBroadcast()`. Phần cần sửa là hợp đồng continuity, projection và cách client đọc bù, không phải thêm lại tính năng push từ đầu.

Vì vậy chưa có đủ căn cứ chọn transport cho mọi mutation hoặc hứa mức tiết kiệm. Cũng không có căn cứ bỏ M2 vì một mẫu write chậm hơn.

## 3. Các nguyên nhân có cơ sở nguồn

| Đường xử lý thực | Việc bị làm lại / rủi ro | Điều chỉnh đề nghị |
|---|---|---|
| Android/Web nhận seq toàn cục nhưng server lọc Picker | Nhận seq nhảy qua sự kiện người khác vẫn gọi recovery. Đây là nhánh bảo vệ hiện có, không được chỉ xóa điều kiện gap. Tần suất do từng nguyên nhân chưa được log mẫu chứng minh. | Stream liên tục theo audience; có predecessor/coverage và generation rõ ràng. |
| `delta()` quét tối đa một cửa sổ global rồi lọc từng row | Lặp query quyền/quan hệ và dựng snapshot cho từng event; chi phí có thể theo số event toàn hệ thống thay vì phần user cần. | Tìm event ứng viên bằng index audience; dùng user context đã xác thực trong invocation; batch lookup và giữ đầy đủ quyền hiện hành. |
| `realtimeBroadcast()` | Snapshot Reporter chung đã reuse; Picker permission + projection vẫn làm trong vòng lặp socket, kể cả nhiều socket cùng người. | Group theo principal + channel/generation + quyền/view; reuse trong invocation; không dùng cache quyền qua message. |
| Reporter resolve/correct Android rồi `refresh()` | Queue/recent/counters bị lấy lại dù giao dịch và event đã biết dòng vừa đổi. | Response đủ patch, dùng cùng reducer với realtime; chỉ reconcile view thiếu dữ liệu. |
| Picker create/withdraw và bootstrap | Reports/results lấy riêng; các nguồn refresh/reconnect có thể chồng nhau. | Snapshot role/view hợp nhất, single-flight recovery trong cùng generation/filter. |
| `currentBatchSnapshot()` | Có summary nhưng còn COUNT DISTINCT, MIN/MAX, displayed và các phép tính cùng batch. | Mở rộng summary có chọn lọc; chứng minh đúng DISTINCT và mọi chuyển trạng thái; đo rows thật. |
| `pickerRealtimeMetadata()` nhánh cuối | Query `actorOwnsEvent` rồi cả hai nhánh trả `{}`. | Bỏ đúng truy vấn không thay đầu ra sau khi giữ nguyên toàn bộ authorization ở caller. Không suy diễn đây là nguồn 133 triệu rows. |
| 1.110 ticket attempts trong mẫu | Reconnect/khởi tạo là tải đáng kể; chưa tách được mạng, auth, lifecycle và retry. | Giữ ticket an toàn; gộp vào bootstrap khi cùng lần gọi, reuse kết nối hợp lệ, đo reason. Không coi có thể xóa cả 1.110 lần. |

Những tối ưu đã có như auth+operation một invocation, prepared FCM, E055 index/summaries, E086 Hibernation, warm schema E097 và counter bền E049 **không được tính thêm lần nữa như saving mới**. Socket lifecycle hiện không phải presence authority; không biến mất mạng thành logout/offline nghiệp vụ.

## 4. Luồng xử lý mới cụ thể

### 4.1. Khởi tạo và một giao dịch

1. Worker kiểm ingress; Core kiểm phiên/role/quyền hiện hành một lần trong invocation. Bootstrap trả các trang đang cần, counters, clock/deadline, capabilities và watermark cùng mốc đọc. Có thể kèm ticket khi chính lần khởi tạo ấy cần mở stream.
2. Một action gửi một command có request ID và expected version. Core dùng transaction hiện tại, chốt business state + event + audience reference + projection liên quan + kết quả idempotency theo thiết kế được kiểm chứng. HTTP/WS gọi hàm nội bộ chung; không `stub.fetch()` vòng lại DO cho mỗi frame.
3. Trả ngay kết quả đã commit; không đợi đủ batch command, không đợi FCM hoặc export log mới báo kết quả nghiệp vụ. FCM/receipt vẫn có đúng tính bền và retry như hợp đồng hiện hành, chỉ đổi callback khi chứng minh tương đương.
4. Response mang patch đủ cho view đã yêu cầu; socket gửi event tới đúng người khác. Reducer dùng event ID, entity version và view revision để chống áp hai lần hoặc phản hồi cũ đè dữ liệu mới. Thiếu dữ liệu chỉ lấy bù view/page bị ảnh hưởng.
5. Command result và cursor stream là hai khái niệm riêng. Nhận response mới không được nhảy cursor qua các event chưa áp dụng. Mất response sau commit: tra kết quả/retry **cùng ID** theo hợp đồng, không tạo thao tác thứ hai hoặc bấm WMS lại.

Ví dụ 100 resolve thuộc đúng nhánh Android hiện có: 100 POST + 300 GET refresh có thể thành 100 POST và patch/push, bỏ 300 GET trên nhánh đó. Nếu cùng handler qua WS sau này đạt gate tốc độ, 100 incoming command có đơn vị request tính phí tương đương khoảng 5, **cộng** handshake/auth/FCM/receipt/recovery. Đây không phải phần trăm giảm toàn mô hình.

### 4.2. Continuity đúng người nhận

Thiết kế ưu tiên **sequence bền theo audience**, lưu reference tới event hiện có; một audience logic cho user Picker hoặc nhóm Reporter có cùng quyền, không tạo stream hoặc bản sao đầy đủ cho mỗi socket. Phải tái dùng quan hệ recipient đang có khi tương đương; việc thêm bảng/index/migration là candidate, chưa được chạy.

Envelope có protocol version, stream epoch, audience identity suy từ server, session generation, previous/current recipient sequence, event ID/entity version và view revision/coverage. Global seq giữ cho audit/legacy; client mới không dùng global +1 để suy mất event trong stream đã lọc.

Ví dụ A nhận global 120, B/C tạo 121/122, rồi A nhận 123. Stream của A chỉ đi 7→8: áp event ngay, không đọc bù B/C. Nếu A thực sự bỏ lỡ recipient seq 8 rồi nhận 9 thì replay đúng phần 8→9. Không có thông điệp “đổi rồi, tải lại tất cả” khi patch đã đủ.

- Audience index chỉ xác định ứng viên; không thay thế live session/RBAC, capability hoặc điều kiện recipient động hiện có. Role/capability/phiên đổi phải ngừng stream cũ và khởi tạo đúng scope mới.
- Snapshot và watermark phải lấy cùng mốc; nối snapshot→catch-up→live có fence rõ và không có khoảng trống. Trang tiếp theo có filter/anchor/revision; phát hiện revision không tương thích thì reconcile trang, không ghép dữ liệu từ hai thời điểm rồi đánh dấu đã đủ.
- Retention/epoch thay đổi → snapshot bounded; replay phân trang tiến cursor sau apply thành công; giới hạn một lượt không có nghĩa đánh dấu trang chưa xem đã áp dụng.
- DISPLAYED, terminal event, withdraw/correct, tombstone và các chuyển trạng thái có ý nghĩa nghiệp vụ phải còn đủ. Không coalesce mất bước quan trọng chỉ để giảm frame.
- Backpressure có giới hạn bytes/số frame. Client chậm phải nhận tín hiệu cần recovery hoặc reconnect đúng scope; không giữ hàng đợi RAM vô hạn hay âm thầm làm mất event.
- Một recovery đang chạy được dùng chung cho các trigger cùng phiên/view; generation hoặc filter đổi thì kết quả cũ bị loại. Không duy trì song song poll định kỳ và push khi stream đã khỏe; đường fallback vẫn giữ chất lượng khi WS không dùng được.

### 4.3. SQL: ghi lúc thay đổi để nhiều lần đọc nhẹ hơn

- Mỗi transaction duy trì đúng các field summary đem lại lợi ích đã đo, trong cùng SQLite. Ví dụ resolved/withdrawn/displayed và deadline tổng hợp; không update toàn bộ lịch sử sau mọi sự kiện.
- `COUNT(DISTINCT ...)` phải giữ nghĩa DISTINCT khi một người có nhiều ticket; không thay bằng cộng/trừ mỗi ticket đơn giản. Khi xóa/sửa/thu hồi/chuyển ngày/rebuild phải đối chiếu với query authority.
- Delta chọn `(audience, recipient_seq)` theo index rồi lookup theo ID; kiểm quyền theo tập thay vì lặp đọc cùng users cho mỗi event. Projection chung dựng một lần; projection Picker theo từng user thực sự bị tác động, reuse cho các socket cùng scope.
- Không cố cache mọi khoảng ngày tùy ý. Summary theo ngày có thể cộng phần nguyên ngày; phần biên và trạng thái thay đổi cần query đúng điều kiện như trước. List còn phải giữ sort, phân trang, badge và phần tử bù khi dòng rời trang.
- RAM cache bounded chỉ giúp hiệu năng. Sau wake/restart, đọc projection persisted đúng version theo phạm vi cần, không rebuild toàn bộ DB trong constructor. Cache miss không được đổi kết quả hoặc bỏ permission.
- Query plan phải đi cùng `cursor.rowsRead/rowsWritten` thực; tính cả index, trigger, telemetry, delete/retention và migration/backfill. Trả một dòng không chứng minh chỉ đọc một dòng; KV trên DO SQLite vẫn tiêu rows.
- Giữ E049 counter bền; không thay bằng RAM mất số khi crash. Telemetry mới chỉ dùng enum reason và aggregate trong log/counter hiện có, không log payload/secret hoặc tạo poller mới.

Đánh đổi được phép kiểm chứng: tăng có giới hạn rows written, index bytes, CPU dựng patch và serialization để giảm HTTP/các lần scan. Không chuyển authority sang D1/Firebase/Sheets hoặc dựng DO trung gian khi chưa cần và chưa được duyệt resource.

## 5. Chọn transport và phạm vi toàn mô hình

| Thành phần / nghiệp vụ | Đường đề nghị | Hợp đồng phải giữ |
|---|---|---|
| Realtime Web/APK | Hibernatable WS hiện có, thêm subscription/continuity mới; push dữ liệu đủ dùng | Đúng audience, cursor/generation, terminal order, deadline, background FCM. |
| Snapshot/recovery khi stream sống | Ưu tiên cùng WS sau compile/auth/parity gate; HTTP cùng handler khi cần | Chỉ lấy phần thiếu, không bỏ auth/receipt, không polling kép. |
| Create/resolve/correct/withdraw/meal/DISPLAYED | Cùng dispatcher; chọn HTTP hoặc WS theo A/B cùng logic đã tối ưu | Idempotency, CAS, correction window, quyền, không offline business queue. Không đổi transport chỉ vì giá 20:1. |
| Agent cloud roster/SKU/Usage | Gom metadata cùng phiên/quyền/cadence khi có lợi; snapshot versioned/chunk bounded | Roster Reporter chỉ xem, auth đúng, SKU schedule/checksum, Usage timestamp và đơn vị. |
| Agent↔PDA Office/WMS/PRIMARY | Giữ carrier Firestore/RTDB và guard hiện hành | Fencing/generation, ACK, lease/heartbeat/timeouts, failover <20s; không ép Office qua Internet WS. |
| FCM/overlay/log/cron | Giữ chức năng/lịch/retry; tận dụng kết quả/metadata đã có | Không bỏ đánh thức nền, DISPLAYED, log 13:15/21:15, xử lý 03:00 ngày kế tiếp, SLA/auto-skip. |
| D172 | Không sửa source/nghiệp vụ/channel riêng; test hồi quy shared Core/Auth/Worker nếu code sau này chạm phần chung | D172 độc lập PENDING/HOLD, không dùng tối ưu Báo hàng để đóng D172. |

“Một đường tối đa” nghĩa là bớt round trip trong cùng ranh giới mạng/quyền/giao dịch. Không có nghĩa đẩy upload log, catalog lớn, provider Usage API hoặc Office/WMS vào hàng đợi chặn lẫn với kết quả báo hàng.

## 6. Ngân sách có thể kiểm chứng

Giá chính thức được kiểm tra 31/10: DO Paid gồm 1 triệu compute requests, 400.000 GB-s, 25 tỷ rows read, 50 triệu rows written và 5 GB-month; Workers gồm 10 triệu requests/30 triệu CPU-ms. Incoming WS application message áp tỷ lệ 20:1 **chỉ cho request billing**; outgoing WS và protocol ping không tính request. Upgrade vẫn tốn request, SQL/duration riêng. Hibernation invocation analytics không phải bộ đếm thuần incoming app messages.

Mỗi chu kỳ phải lập sổ:

`request_equivalent ≈ HTTP + RPC + handshake + alarm + incoming_app_messages/20`

Tách từng nhóm từ instrumentation và đối chiếu billable usage; event close/error/auto-response chưa phân loại không được tự chia 20. Không lấy `90 + 317/20` làm hóa đơn chứng minh E115 tiết kiệm. Billing có độ trễ; lab cùng account cũng tiêu quota.

**Bỏ giả định coi 8.000 H/ngày là số đã đạt.** Lập `H_floor` theo auth/ticket/upgrade, mutation còn HTTP, fallback, background/cron/SKU/log/FCM, client cũ và tải shared. Mỗi nhóm phải có count/source; không đủ attribution thì ngân sách chưa PASS. Đơn vị request còn lại quyết định có cần đưa thêm command sang WS, sau gate tốc độ.

Giữ các trần thiết kế E107 như giới hạn candidate, đồng thời thêm điều kiện tương đối:

| Meter | Gate thiết kế / đối chứng |
|---|---|
| Inventory DO request-equivalent | ≤450.000/chu kỳ 31 ngày; phân bổ 50% included có phần đệm 50.000. Tổng account và phần dự phòng/rollback phải vẫn ≤1.000.000. |
| Rows Read | Không cao hơn baseline cùng logical work; từng hot path phải giảm thật, không chỉ đổi tên meter; đồng thời ≤10 tỷ/31 ngày. Trần 10 tỷ không có nghĩa được tăng từ baseline đang thấp hơn. |
| Rows Written / DO duration / SQL storage | ≤20 triệu /100.000 GB-s /2 GB-month, bao gồm audience/index/summary/telemetry/retention và cold start. |
| Worker requests / CPU | ≤4 triệu /12 triệu ms, đo riêng scope và đơn vị. |
| Workers Logs | ≤8 triệu events theo giá hiện hành; kiểm lại thay đổi công bố từ 01/12/2026. Không thêm log mỗi ping/frame để đo rồi vượt meter. |
| Firebase/Google và phần dùng chung | Không chuyển thêm tải để che DO. Kiểm free tier/chu kỳ riêng và số dùng của các project khác; thiếu dữ liệu là UNKNOWN, không phải 0. |

Ví dụ điều kiện toán học, **không phải forecast đã đo**: với 450.000/31 ngày và 10.000 incoming app messages/ngày, H tối đa khoảng 14.016/ngày; nếu messages 100.000/ngày, H tối đa khoảng 9.516/ngày. Con số này phải kiểm bằng route thực, không chọn H đẹp để tạo PASS. Làm tròn theo ngày chỉ là planning bảo thủ, không mô tả cách invoice làm tròn.

Ngày 27 nếu 31 ngày đều giống số raw HTTP 54.055 thì có 1.675.705 HTTP invocations; đây là cảnh báo tải theo điều kiện, **không phải dự báo billable toàn tháng**. Rows Read cùng phép tính là 4.126.594.388 (~16,51% included), cho thấy cần giảm request trước nhưng vẫn phải giảm những scan thừa để có headroom.

Hibernation là điều kiện tài chính: không `setInterval` hoặc công việc chờ nền kéo DO thức để né request. Outbound I/O và constructor sau wake được tính trong benchmark. Không tự dùng `usage_block`, ngắt nghiệp vụ, kéo deadline hay mua gói để ép đạt 5 USD. Với tải/lỗi/account khác không giới hạn, không thể bảo đảm tuyệt đối hóa đơn cố định mà vẫn không bao giờ dừng dịch vụ; mục tiêu chỉ được nghiệm thu trên tải và tổng account đã kiểm chứng.

## 7. Đối chứng mới phải thay cách kiểm thử

So sánh ba cấu hình **cùng logical workload**, không ép cùng số network calls:

| Cấu hình | Mục đích |
|---|---|
| A — HTTP/WS hiện hành, đúng release source | Baseline cả pipeline và semantics. |
| B — snapshot/patch + audience push + SQL đã tối ưu; mutation HTTP | Đo lợi ích do bỏ việc thừa, tách khỏi transport. |
| C — đúng logic B; chuyển những operation phù hợp sang WS | Đo phần tăng/giảm riêng do transport, auth/handshake/cold start/fallback tính đủ. |

Điều kiện thực thi:

1. Dùng cùng state ban đầu, actor/quyền, logical action schedule, payload/filter/page/deadline và fault schedule. Timestamps ngẫu nhiên/UUID được ánh xạ nhất quán; mọi field nghiệp vụ còn lại phải so chính xác. Dữ liệu gốc chỉ có bucket giờ thì gọi đúng là **workload dựng từ phân bố**, không “replay chính xác cả ngày”.
2. Model có 60 principal độc lập, đúng số Reporter và Agent trong load đã xác minh; thêm 20 PDA khác nhau trong 5 giây. So 1/20/60 kết nối, trạng thái cold/warm/hibernate-resume; đảo thứ tự A/B/C và lặp đủ để đánh giá nhiễu.
3. Cả ba nhận cùng thay đổi và cuối cùng đúng cùng trạng thái. Đếm event bắt buộc đã tới đúng người, không chỉ HTTP200. Đo action→durable result→đổi màn hình/overlay; p50/p95/p99, lỗi/timeout, retry/reconnect, pin/RAM và HA. Mutation C chưa thắng/đạt parity thì giữ HTTP ở operation ấy và tính lại ngân sách toàn mô hình.
4. Stress kết nối tách cửa sổ đo; hoặc được đưa vào mọi cấu hình với cùng logical reconnect schedule. Meter init/schema/fixture, auth, ticket, upgrade, read, write, replay, FCM/receipt, background, cold wake và teardown được báo riêng; không giấu setup khi đánh giá tổng ngày.
5. Frame/socket/time/byte caps phải enforce thật và dừng fail-closed khi vượt. Trần một lần cloud trước đây là 700 traffic units; không tự mở rộng lên 10.403 calls hoặc chạy lại nhãn cloud một lần. Dùng local/CI cho coverage lớn; kiểm cloud bounded theo scope/budget được duyệt riêng trước khi bắn tải.
6. Namespace/object ID và cửa sổ đo được ghi từ runtime, không chỉ suy từ hình dạng metrics; initial state và code SHA rõ ràng. Chờ analytics đầy đủ bằng read-only, không lặp bắn traffic khi meter chưa hiện. Attribution SQL và billable request phân biệt, provider metrics đối chiếu sau trễ.

### Ma trận yêu cầu → hợp đồng → kiểm chứng bắt buộc

| Yêu cầu | Thành phần/hợp đồng | Ca thử phân biệt lỗi |
|---|---|---|
| Kết quả giữ nguyên | Core, summary, client reducers | Toàn bộ create/group/withdraw/resolve/correct/meal/auto-skip/DISPLAYED, counters/filter/sort/page/deadline; so database và view, không chỉ shape. |
| Giảm delta dư, không mất event | Audience/epoch/coverage | A/B/C xen kẽ global seq; thật sự mất một event; tombstone; >200 events; hết retention; snapshot/live race; socket chậm. |
| Một action một lần | Request ID/CAS/shared dispatcher | Commit mất response; WS→HTTP cùng ID; same ID khác payload; duplicate/đảo thứ tự; crash/restart; response cũ tới sau event mới. |
| Quyền/phiên đúng | Worker auth, Core context, socket attachment | Kick/replace/disable/change role/capability/expiry khi socket còn mở và sau hibernation; không rò payload giữa user/view. |
| Tốc độ và ổn định giữ nguyên | Web/APK/Agent/end-to-end | Paired p95/p99 và error rate không kém baseline ngoài nhiễu đã giải thích; SLA nghiệp vụ <5s, HA <20s và thông số hiện hành vẫn giữ. Đo thực PDA/Windows trước FIELD PASS. |
| Thời gian và tác vụ nền đúng | Alarm/FCM/overlay/03:00/logs | VN day boundary, sửa sát hạn, 03:00 ngày kế tiếp, ngủ/thức, FCM trước/sau WS, DISPLAYED retry, token invalid. |
| Office/WMS không hồi quy | Firestore/RTDB/PRIMARY/fencing | WS bị chặn cả ca; lease chuyển khi confirm; WMS thành công nhưng ACK mất; không click lại; đúng ACK canonical. |
| SQL và usage không bị dồn chỗ khác | Index/summary/telemetry/constructor | Match rows thật incl trigger/index; warm/cold wake; sparse audience; high fan-out; fallback 100%; thêm writes và GB-s vẫn trong tổng account. |
| D172 an toàn | Shared Worker/Core/Auth/schema | Hồi quy D172 auth/API/SQLite/Sheet trên fixture nếu sửa phần chung; không sửa APK/channel/dữ liệu riêng. |

## 8. Trạng thái CI và bước tiếp theo

Tại head E115 `2adf96b4`, GitHub trả 33 checks: 17 SUCCESS, 15 SKIPPED, **1 FAILURE**. Job `source-only` trong [run41176493057](https://github.com/tamnv2/supra-inventory/actions/runs/41176493057) báo `D173_EMAIL_RELEASE_DENIED: protected source changed after approved source pin`. Đây là gate đang đỏ của nhánh nghiên cứu; bài cloud 27/27 không có nghĩa toàn PR xanh. Không sửa/bỏ pin mail hoặc lách release guard trong đợt phân tích này. CODE runtime/RELEASE/FIELD/FINANCIAL/OWNER PASS của kiến trúc mới đều chưa có.

Bước hợp lý trong cùng D173: dùng thiết kế này làm contract cho candidate cô lập; thực hiện B trước để đo tác động xử lý, C dùng cùng dispatcher để so transport. Chuẩn bị đầy đủ source Web/APK/Agent liên quan, test parity/fault/SQL, sau đó mới đối chứng cloud bounded và lập forecast từ số đếm thực. Release chỉ khi exact-source CI, shared D172 regression, field/usage gates và quyền phát hành phù hợp đã đủ. E105 Agent162 FIELD FAIL và E097 root cause không được coi đã giải quyết nhờ thiết kế này.

## 9. Rủi ro và rollback

Thay đổi sau này ảnh hưởng Worker/Core, event/read contracts, Web/APK reducers và cloud adapter cần thiết của Agent; không đòi đổi UI hoặc thay database authority. Rủi ro chính là cursor sai, projection thiếu, quyền stale, idempotency không bền, socket backpressure và writes/duration tăng. Ma trận ở trên phải được triển khai trước khi nâng mức PASS.

Protocol/capability negotiation theo phiên bản; old client giữ endpoint hiện hành. Không chạy hai mutation để so. Rollback chọn adapter/handler đã tương thích trên **cùng** authority, giữ event và request-result bổ sung đến hết retention an toàn; không xóa DB hoặc dữ liệu để quay lại. Tính cả client cũ, fallback 100%, rollout/rollback và tải D172 trong forecast. Nếu phần HTTP không thể tối ưu đủ trong tình huống WS bị chặn, phải nói rõ phạm vi ngân sách chưa đạt; không hy sinh vận hành hoặc dùng quota khác để che.

Đợt E116 này chỉ thêm báo cáo và đồng bộ hồ sơ thảo luận/trạng thái trên nhánh Draft. Không thay `service/`, `web/`, `android/`, `relay-agent/`, Firebase, workflow, resource, nhãn chạy cloud hay release channel.

## 10. Chỉ dẫn nguồn kiểm tra lại

- `tools/d173_e115_day27/test-real-day27.mjs`: actor/burst, 60 stress sockets, after_seq=0, assertion parity/status, thứ tự và batching 8 reads, budget counters.
- `tools/d173_e112_real_core_lab/worker.ts`: fixture identity, actual Core adapter, limit=50, loại prepared FCM khỏi result.
- `service/src/core.ts::webSocketMessage`, authorized routes, constructor; `service/src/read-model-core.ts::connectRealtime/realtimeBroadcast`: một chiều production, ticket/attachment/Hibernation và per-socket projection.
- `service/src/operational-v2-core.ts::delta/pickerCanReceiveRealtimeEvent/pickerRealtimeMetadata/currentBatchSnapshot`; `service/src/d173-persistent-usage.ts`: global scan, quyền, snapshot và counter bền.
- Android `AndroidRealtimeClient.kt::handleInvalidate/recoverDelta/reconcileAndCommit`, `ReporterController.kt::resolveBatch/correct/refresh`, `PickerController.kt::refresh/create/withdraw`; Web `web/src/realtime-client.ts::handleFrame/recoverDelta`.
- [E115 results](D173_E115_20261027_REAL_TRAFFIC_TEST_RESULTS_2026-10-31.md), [E107 architecture/budget](D173_E107_WHOLE_MODEL_FIVE_DOLLAR_ARCHITECTURE_2026-10-31.md), [remote test41175960126](https://github.com/tamnv2/supra-inventory/actions/runs/41175960126), [delayed provider41176347995](https://github.com/tamnv2/supra-inventory/actions/runs/41176347995).
- Primary Cloudflare: [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/), [SQLite API/rows/index writes](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/). Checked 31/10/2026; invoices/account attribution remain separate evidence.
